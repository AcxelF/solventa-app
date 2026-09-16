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
  updateTransaction,
  deleteTransaction,
  getSummary,
  getTransaction,
  ValidationError,
};
