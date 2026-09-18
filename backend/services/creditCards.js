const db = require("../db");
const { ValidationError } = require("./errors");

const CARD_TYPE = "Tarjeta de crédito";
const BRANDS = ["Visa", "Mastercard", "Amex", "Diners"];
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const DAY_MS = 86400000;

function pad2(value) {
  return String(value).padStart(2, "0");
}

// Devuelve la fecha (año, mes 1-12, día) con el día recortado al último día
// real del mes (soporta días 29, 30 y 31 en meses con menos días).
function buildDate(year, month, day) {
  const lastDay = new Date(year, month, 0).getDate();
  return { year, month, day: Math.min(day, lastDay) };
}

function shiftMonth(year, month, delta) {
  const total = month - 1 + delta;
  return {
    year: year + Math.floor(total / 12),
    month: ((total % 12) + 12) % 12 + 1,
  };
}

function monthDate(year, month, day, delta) {
  const shifted = shiftMonth(year, month, delta);
  return buildDate(shifted.year, shifted.month, day);
}

function toISO({ year, month, day }) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

async function getCard(id) {
  return db.get("SELECT * FROM accounts WHERE id = ? AND type = ?", [
    id,
    CARD_TYPE,
  ]);
}

async function sumSpending(accountId, fromISO, toISO, inclusive) {
  const sql = inclusive
    ? `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE account_id = ? AND type = 'gasto' AND date >= ? AND date <= ?`
    : `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE account_id = ? AND type = 'gasto' AND date >= ? AND date < ?`;
  const row = await db.get(sql, [accountId, fromISO, toISO]);
  return row.total;
}

async function getConsumedUnpaid(accountId) {
  // "Consumido y no pagado" = gastos - pagos registrados en la tarjeta.
  const row = await db.get(
    `SELECT COALESCE(SUM(CASE WHEN type = 'gasto' THEN amount ELSE -amount END), 0) AS total
     FROM transactions WHERE account_id = ?`,
    [accountId]
  );
  return Math.max(0, row.total);
}

// Pagos de la línea de tiempo: independientes del ciclo de corte.
//  - Pago anterior: la última fecha de pago ya pasada (anterior o igual a hoy).
//  - Próximo pago: la primera fecha de pago posterior a hoy.
function computePaymentDates(today, paymentDay) {
  const thisMonthPayment = buildDate(today.year, today.month, paymentDay);
  if (toISO(thisMonthPayment) <= toISO(today)) {
    return {
      prevPayment: thisMonthPayment,
      nextPayment: monthDate(today.year, today.month, paymentDay, 1),
    };
  }
  return {
    prevPayment: monthDate(today.year, today.month, paymentDay, -1),
    nextPayment: thisMonthPayment,
  };
}

async function computeCycle(card) {
  const now = new Date();
  const today = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
  const todayISO = toISO(today);

  // Próximo corte: si el día de corte de este mes ya pasó, es el del próximo mes.
  const thisMonthCut = buildDate(today.year, today.month, card.cut_day);
  const nextCut =
    toISO(thisMonthCut) <= todayISO
      ? monthDate(today.year, today.month, card.cut_day, 1)
      : thisMonthCut;

  // Cortes previos: siempre un mes y dos meses antes del próximo corte.
  const lastCut = monthDate(nextCut.year, nextCut.month, card.cut_day, -1);
  const prevCut = monthDate(nextCut.year, nextCut.month, card.cut_day, -2);

  // Pagos: la línea de tiempo de pagos es independiente del ciclo de corte.
  const { prevPayment, nextPayment } = computePaymentDates(
    today,
    card.payment_day
  );

  const prevCutISO = toISO(prevCut);
  const lastCutISO = toISO(lastCut);

  // Consumo del periodo actual: desde el corte anterior hasta hoy (inclusivo).
  const currentConsumption = await sumSpending(card.id, lastCutISO, todayISO, true);
  // Monto a pagar: consumo del periodo ya cerrado entre los dos cortes previos.
  const amountDue = await sumSpending(card.id, prevCutISO, lastCutISO, false);

  const daysToNextPayment = Math.round(
    (new Date(`${toISO(nextPayment)}T00:00:00`) -
      new Date(`${todayISO}T00:00:00`)) /
      DAY_MS
  );

  // Crédito disponible: línea de crédito menos lo consumido y no pagado.
  const consumedUnpaid = await getConsumedUnpaid(card.id);
  const availableCredit = Math.max(0, card.credit_limit - consumedUnpaid);

  const nextPaymentISO = toISO(nextPayment);
  const paymentRow = await db.get(
    "SELECT 1 FROM credit_card_payments WHERE card_id = ? AND due_date = ?",
    [card.id, nextPaymentISO]
  );

  return {
    today: todayISO,
    prev_cut: prevCutISO,
    last_cut: lastCutISO,
    next_cut: toISO(nextCut),
    prev_payment: toISO(prevPayment),
    next_payment: nextPaymentISO,
    next_payment_paid: Boolean(paymentRow),
    days_to_next_payment: daysToNextPayment,
    current_consumption: currentConsumption,
    amount_due: amountDue,
    available_credit: availableCredit,
  };
}

async function withCycle(card) {
  return card ? { ...card, cycle: await computeCycle(card) } : null;
}

function validateCard({
  name,
  brand,
  last_four,
  credit_limit,
  cut_day,
  payment_day,
  color,
  interest_rate,
}) {
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new ValidationError("El alias de la tarjeta es obligatorio.");
  }
  if (!BRANDS.includes(brand)) {
    throw new ValidationError(
      "La marca debe ser Visa, Mastercard, Amex o Diners."
    );
  }
  if (!/^\d{4}$/.test(String(last_four || ""))) {
    throw new ValidationError("Los últimos 4 dígitos deben ser 4 números.");
  }
  if (
    typeof credit_limit !== "number" ||
    !Number.isFinite(credit_limit) ||
    credit_limit <= 0
  ) {
    throw new ValidationError(
      "La línea de crédito debe ser un número mayor a 0."
    );
  }
  if (!Number.isInteger(cut_day) || cut_day < 1 || cut_day > 31) {
    throw new ValidationError("El día de corte debe ser un número entre 1 y 31.");
  }
  if (!Number.isInteger(payment_day) || payment_day < 1 || payment_day > 31) {
    throw new ValidationError("El día de pago debe ser un número entre 1 y 31.");
  }
  if (!color || typeof color !== "string" || !HEX_COLOR.test(color)) {
    throw new ValidationError("El color debe ser un hex válido (ej: #1A1F71).");
  }
  if (
    interest_rate !== undefined &&
    interest_rate !== null &&
    (typeof interest_rate !== "number" || !Number.isFinite(interest_rate) || interest_rate < 0)
  ) {
    throw new ValidationError("La tasa de interés (TEA) debe ser un número mayor o igual a 0.");
  }
}

async function listCreditCards() {
  const cards = await db.all("SELECT * FROM accounts WHERE type = ? ORDER BY id", [
    CARD_TYPE,
  ]);
  const withCycles = [];
  for (const card of cards) {
    withCycles.push(await withCycle(card));
  }
  return withCycles;
}

async function createCreditCard(fields = {}) {
  validateCard(fields);

  const result = await db.run(
    `INSERT INTO accounts
       (name, type, color, brand, last_four, credit_limit, cut_day, payment_day, interest_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fields.name.trim(),
      CARD_TYPE,
      fields.color,
      fields.brand,
      fields.last_four,
      fields.credit_limit,
      fields.cut_day,
      fields.payment_day,
      fields.interest_rate ?? null,
    ]
  );

  return withCycle(await getCard(result.lastInsertRowid));
}

async function updateCreditCard(id, fields = {}) {
  const existing = await getCard(id);
  if (!existing) return null;

  const next = { ...existing, ...fields };
  validateCard(next);

  await db.run(
    `UPDATE accounts
     SET name = ?, color = ?, brand = ?, last_four = ?, credit_limit = ?, cut_day = ?, payment_day = ?, interest_rate = ?
     WHERE id = ?`,
    [
      next.name.trim(),
      next.color,
      next.brand,
      next.last_four,
      next.credit_limit,
      next.cut_day,
      next.payment_day,
      next.interest_rate ?? null,
      id,
    ]
  );

  return withCycle(await getCard(id));
}

async function deleteCreditCard(id) {
  const existing = await getCard(id);
  if (!existing) return false;

  const count = await db.get(
    "SELECT COUNT(*) AS n FROM transactions WHERE account_id = ?",
    [id]
  );
  if (count.n > 0) {
    throw new ValidationError(
      "No puedes eliminar una tarjeta que tiene movimientos asociados."
    );
  }

  const result = await db.run("DELETE FROM accounts WHERE id = ?", [id]);
  return result.changes > 0;
}

async function getCreditCard(id) {
  return withCycle(await getCard(id));
}

async function markPaymentPaid(cardId, dueDate) {
  const card = await getCard(cardId);
  if (!card) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || ""))) {
    throw new ValidationError("La fecha de pago no es válida.");
  }

  await db.run(
    `INSERT INTO credit_card_payments (card_id, due_date)
     VALUES (?, ?)
     ON CONFLICT (card_id, due_date) DO NOTHING`,
    [cardId, dueDate]
  );

  return withCycle(card);
}

async function unmarkPaymentPaid(cardId, dueDate) {
  const card = await getCard(cardId);
  if (!card) return null;

  await db.run(
    "DELETE FROM credit_card_payments WHERE card_id = ? AND due_date = ?",
    [cardId, dueDate]
  );

  return withCycle(card);
}

module.exports = {
  listCreditCards,
  createCreditCard,
  updateCreditCard,
  deleteCreditCard,
  getCreditCard,
  markPaymentPaid,
  unmarkPaymentPaid,
};
