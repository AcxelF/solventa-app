const db = require("../db");
const { ValidationError } = require("./errors");

const SELECT_JOINED = `
  SELECT
    t.*,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,
    a.name AS account_name,
    a.type AS account_type,
    a.color AS account_color
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  JOIN accounts a ON a.id = t.account_id
`;

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getTransaction(id) {
  return db.get(`${SELECT_JOINED} WHERE t.id = ?`, [id]);
}

async function listTransactions({
  account_id,
  category_id,
  from,
  to,
  month,
} = {}) {
  const conditions = [];
  const params = [];

  if (account_id) {
    conditions.push("t.account_id = ?");
    params.push(account_id);
  }
  if (category_id) {
    conditions.push("t.category_id = ?");
    params.push(category_id);
  }
  if (from) {
    conditions.push("t.date >= ?");
    params.push(from);
  }
  if (to) {
    conditions.push("t.date <= ?");
    params.push(to);
  }
  if (month) {
    conditions.push("substr(t.date, 1, 7) = ?");
    params.push(month);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.all(
    `${SELECT_JOINED} ${where} ORDER BY t.date DESC, t.id DESC`,
    params
  );
}

async function validateTransaction({ account_id, category_id, type, amount }) {
  if (!["ingreso", "gasto"].includes(type)) {
    throw new ValidationError("El tipo debe ser 'ingreso' o 'gasto'.");
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("El monto debe ser un número mayor a 0.");
  }
  if (!Number.isInteger(account_id)) {
    throw new ValidationError("La cuenta es obligatoria.");
  }
  if (!Number.isInteger(category_id)) {
    throw new ValidationError("La categoría es obligatoria.");
  }

  const account = await db.get("SELECT id FROM accounts WHERE id = ?", [
    account_id,
  ]);
  if (!account) {
    throw new ValidationError("La cuenta seleccionada no existe.");
  }

  const category = await db.get("SELECT id, type FROM categories WHERE id = ?", [
    category_id,
  ]);
  if (!category) {
    throw new ValidationError("La categoría seleccionada no existe.");
  }
  if (category.type !== type) {
    throw new ValidationError(`La categoría debe ser de tipo "${type}".`);
  }
}

async function createTransaction({
  account_id,
  category_id,
  type,
  amount,
  description,
  date,
} = {}) {
  await validateTransaction({ account_id, category_id, type, amount });

  const transactionDate = date || getTodayISO();

  const result = await db.run(
    `INSERT INTO transactions (account_id, category_id, type, amount, description, date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      account_id,
      category_id,
      type,
      amount,
      description || null,
      transactionDate,
    ]
  );

  return getTransaction(result.lastInsertRowid);
}

// Suma `delta` meses a una fecha ISO (YYYY-MM-DD), recortando al último día
// real del mes de destino (ej. 31 ene + 1 mes -> 28/29 feb, no 3 marzo).
function addMonthsISO(dateISO, delta) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const totalMonths = m - 1 + delta;
  const year = y + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12 + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// Reparte el total en cuotas iguales (sin interés), ajustando centavos en la
// última cuota para que la suma exacta del total no se pierda por redondeo.
// Se usa cuando la cuenta no tiene una TEA configurada.
function evenInstallments(totalAmount, totalInstallments) {
  const baseAmount = Math.floor((totalAmount / totalInstallments) * 100) / 100;
  const roundedTotal = Math.round(baseAmount * 100) * totalInstallments;
  const remainder = Math.round(totalAmount * 100) - roundedTotal;

  const schedule = [];
  for (let i = 0; i < totalInstallments; i++) {
    const isLast = i === totalInstallments - 1;
    const amount = isLast ? baseAmount + remainder / 100 : baseAmount;
    schedule.push({ amount: round2(amount) });
  }
  return schedule;
}

// Cuota fija (sistema francés): mismo pago total cada mes, con interés sobre
// el saldo pendiente calculado a partir de la TEA de la tarjeta. Así cada
// cuota trae capital + interés como en el estado de cuenta real del banco,
// en vez de solo repartir el precio de lista entre el número de cuotas.
function amortizedInstallments(totalAmount, totalInstallments, annualRatePercent) {
  const monthlyRate = Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1;
  const payment =
    (totalAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -totalInstallments));

  let remaining = totalAmount;
  const schedule = [];
  for (let i = 0; i < totalInstallments; i++) {
    const isLast = i === totalInstallments - 1;
    const interest = remaining * monthlyRate;
    const capital = isLast ? remaining : payment - interest;
    schedule.push({ amount: round2(capital + interest) });
    remaining -= capital;
  }
  return schedule;
}

// Crea una compra en cuotas: una transacción por cada cuota, una por mes,
// cada una con el monto de esa cuota (no el total). Así el saldo/resumen
// mensual y el ciclo de la tarjeta (que suman por fecha) solo cuentan la
// cuota que corresponde a cada mes, sin lógica especial en otros lugares.
async function createInstallmentPurchase({
  account_id,
  category_id,
  type,
  total_amount,
  total_installments,
  description,
  date,
} = {}) {
  if (!Number.isInteger(total_installments) || total_installments < 2) {
    throw new ValidationError("El número de cuotas debe ser un entero de al menos 2.");
  }
  await validateTransaction({ account_id, category_id, type, amount: total_amount });

  const startDate = date || getTodayISO();
  const groupId = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const account = await db.get("SELECT interest_rate FROM accounts WHERE id = ?", [account_id]);
  const schedule = account?.interest_rate
    ? amortizedInstallments(total_amount, total_installments, account.interest_rate)
    : evenInstallments(total_amount, total_installments);

  const createdIds = [];
  for (let i = 0; i < total_installments; i++) {
    const amount = schedule[i].amount;
    const installmentDate = addMonthsISO(startDate, i);
    const installmentDescription = description
      ? `${description} (cuota ${i + 1}/${total_installments})`
      : `Cuota ${i + 1}/${total_installments}`;

    const result = await db.run(
      `INSERT INTO transactions
         (account_id, category_id, type, amount, description, date, installment_group_id, installment_number, total_installments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account_id,
        category_id,
        type,
        Math.round(amount * 100) / 100,
        installmentDescription,
        installmentDate,
        groupId,
        i + 1,
        total_installments,
      ]
    );
    createdIds.push(result.lastInsertRowid);
  }

  const created = [];
  for (const id of createdIds) {
    created.push(await getTransaction(id));
  }
  return created;
}

async function updateTransaction(id, fields = {}) {
  const raw = await db.get("SELECT * FROM transactions WHERE id = ?", [id]);
  if (!raw) return null;

  const next = { ...raw, ...fields };
  await validateTransaction(next);

  await db.run(
    `UPDATE transactions
     SET account_id = ?, category_id = ?, type = ?, amount = ?, description = ?, date = ?
     WHERE id = ?`,
    [
      next.account_id,
      next.category_id,
      next.type,
      next.amount,
      next.description || null,
      next.date,
      id,
    ]
  );

  return getTransaction(id);
}

async function deleteTransaction(id) {
  const result = await db.run("DELETE FROM transactions WHERE id = ?", [id]);
  return result.changes > 0;
}

async function getSummary({ month, account_id } = {}) {
  const transactions = await listTransactions({ month, account_id });

  let totalIngresos = 0;
  let totalGastos = 0;
  let gastosLiquidos = 0;
  let gastosCredito = 0;
  const byCategoryMap = new Map();

  for (const t of transactions) {
    if (t.type === "ingreso") {
      totalIngresos += t.amount;
    } else {
      totalGastos += t.amount;
      if (t.account_type === "Tarjeta de crédito") {
        gastosCredito += t.amount;
      } else {
        gastosLiquidos += t.amount;
      }

      const current = byCategoryMap.get(t.category_id) || {
        category_id: t.category_id,
        category: t.category_name,
        icon: t.category_icon,
        color: t.category_color,
        total: 0,
      };
      current.total += t.amount;
      byCategoryMap.set(t.category_id, current);
    }
  }

  const byCategory = [...byCategoryMap.values()].sort(
    (a, b) => b.total - a.total
  );

  const initialLiquidRow = await db.get(
    `SELECT COALESCE(SUM(initial_balance), 0) AS total FROM accounts
     WHERE type != 'Tarjeta de crédito' ${account_id ? "AND id = ?" : ""}`,
    account_id ? [account_id] : []
  );

  const totalBalanceRow = await db.get(
    `SELECT COALESCE(SUM(CASE WHEN t.type = 'ingreso' THEN t.amount ELSE -t.amount END), 0) AS liquidBalance
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.type != 'Tarjeta de crédito' ${account_id ? "AND t.account_id = ?" : ""}`,
    account_id ? [account_id] : []
  );

  const initialCreditRow = await db.get(
    `SELECT COALESCE(SUM(initial_balance), 0) AS total FROM accounts
     WHERE type = 'Tarjeta de crédito' ${account_id ? "AND id = ?" : ""}`,
    account_id ? [account_id] : []
  );

  const creditDebtRow = await db.get(
    `SELECT COALESCE(SUM(CASE WHEN t.type = 'gasto' THEN t.amount ELSE -t.amount END), 0) AS creditDebt
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.type = 'Tarjeta de crédito' ${account_id ? "AND t.account_id = ?" : ""}`,
    account_id ? [account_id] : []
  );

  const liquidBalance = (totalBalanceRow ? totalBalanceRow.liquidBalance : 0) + initialLiquidRow.total;
  const creditDebt = (creditDebtRow ? creditDebtRow.creditDebt : 0) + initialCreditRow.total;

  return {
    totalBalance: liquidBalance,
    creditDebt: Math.max(0, creditDebt),
    totalIngresos,
    totalGastos,
    gastosLiquidos,
    gastosCredito,
    balance: totalIngresos - totalGastos,
    byCategory,
  };
}

module.exports = {
  listTransactions,
  createTransaction,
  createInstallmentPurchase,
  updateTransaction,
  deleteTransaction,
  getSummary,
  getTransaction,
  ValidationError,
};
