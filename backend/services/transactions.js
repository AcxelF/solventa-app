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

function getTransaction(id) {
  return db.prepare(`${SELECT_JOINED} WHERE t.id = ?`).get(id);
}

function listTransactions({
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
  return db
    .prepare(`${SELECT_JOINED} ${where} ORDER BY t.date DESC, t.id DESC`)
    .all(...params);
}

function validateTransaction({ account_id, category_id, type, amount }) {
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

  const account = db.prepare("SELECT id FROM accounts WHERE id = ?").get(account_id);
  if (!account) {
    throw new ValidationError("La cuenta seleccionada no existe.");
  }

  const category = db
    .prepare("SELECT id, type FROM categories WHERE id = ?")
    .get(category_id);
  if (!category) {
    throw new ValidationError("La categoría seleccionada no existe.");
  }
  if (category.type !== type) {
    throw new ValidationError(`La categoría debe ser de tipo "${type}".`);
  }
}

function createTransaction({
  account_id,
  category_id,
  type,
  amount,
  description,
  date,
} = {}) {
  validateTransaction({ account_id, category_id, type, amount });

  const transactionDate = date || getTodayISO();

  const result = db
    .prepare(
      `INSERT INTO transactions (account_id, category_id, type, amount, description, date)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      account_id,
      category_id,
      type,
      amount,
      description || null,
      transactionDate
    );

  return getTransaction(result.lastInsertRowid);
}

function updateTransaction(id, fields = {}) {
  const raw = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
  if (!raw) return null;

  const next = { ...raw, ...fields };
  validateTransaction(next);

  db.prepare(
    `UPDATE transactions
     SET account_id = ?, category_id = ?, type = ?, amount = ?, description = ?, date = ?
     WHERE id = ?`
  ).run(
    next.account_id,
    next.category_id,
    next.type,
    next.amount,
    next.description || null,
    next.date,
    id
  );

  return getTransaction(id);
}

function deleteTransaction(id) {
  const result = db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
  return result.changes > 0;
}

function getSummary({ month, account_id } = {}) {
  const transactions = listTransactions({ month, account_id });

  let totalIngresos = 0;
  let totalGastos = 0;
  const byCategoryMap = new Map();

  for (const t of transactions) {
    if (t.type === "ingreso") {
      totalIngresos += t.amount;
    } else {
      totalGastos += t.amount;
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

  const totalBalanceRow = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE -amount END), 0) AS balance
       FROM transactions ${account_id ? "WHERE account_id = ?" : ""}`
    )
    .get(...(account_id ? [account_id] : []));

  return {
    totalBalance: totalBalanceRow.balance,
    totalIngresos,
    totalGastos,
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
