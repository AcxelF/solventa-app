const db = require("../db");
const { ValidationError } = require("./errors");
const transactionsService = require("./transactions");

const MONTH_RE = /^\d{4}-\d{2}$/;

const SELECT_JOINED = `
  SELECT
    b.*,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color
  FROM budgets b
  JOIN categories c ON c.id = b.category_id
`;

function validateMonth(month) {
  if (typeof month !== "string" || !MONTH_RE.test(month)) {
    throw new ValidationError("El mes debe tener formato YYYY-MM.");
  }
  const monthIndex = Number(month.split("-")[1]);
  if (monthIndex < 1 || monthIndex > 12) {
    throw new ValidationError("El mes debe estar entre 01 y 12.");
  }
}

function validateAmount(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("El monto debe ser un número mayor a 0.");
  }
}

function getBudgetById(id) {
  return db.prepare(`${SELECT_JOINED} WHERE b.id = ?`).get(id);
}

function spendByCategory(months) {
  const map = new Map();
  for (const month of new Set(months)) {
    const summary = transactionsService.getSummary({ month });
    for (const row of summary.byCategory) {
      map.set(`${month}:${row.category_id}`, row.total);
    }
  }
  return map;
}

function enrich(budgets) {
  if (!budgets.length) return [];
  const spend = spendByCategory(budgets.map((b) => b.month));
  return budgets.map((b) => {
    const spent = spend.get(`${b.month}:${b.category_id}`) || 0;
    return {
      id: b.id,
      category_id: b.category_id,
      category: b.category_name,
      icon: b.category_icon,
      color: b.category_color,
      month: b.month,
      amount: b.amount,
      spent,
      percent: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
      overLimit: spent > b.amount,
    };
  });
}

function listBudgets({ month } = {}) {
  if (month) validateMonth(month);
  const budgets = month
    ? db
        .prepare(
          `${SELECT_JOINED} WHERE b.month = ? ORDER BY c.name COLLATE NOCASE`
        )
        .all(month)
    : db
        .prepare(
          `${SELECT_JOINED} ORDER BY b.month DESC, c.name COLLATE NOCASE`
        )
        .all();
  return enrich(budgets);
}

function createBudget({ category_id, month, amount } = {}) {
  validateMonth(month);
  validateAmount(amount);
  if (!Number.isInteger(category_id)) {
    throw new ValidationError("La categoría es obligatoria.");
  }

  const category = db
    .prepare("SELECT id, type FROM categories WHERE id = ?")
    .get(category_id);
  if (!category) {
    throw new ValidationError("La categoría seleccionada no existe.");
  }
  if (category.type !== "gasto") {
    throw new ValidationError(
      "Solo puedes asignar presupuesto a categorías de gasto."
    );
  }

  try {
    const result = db
      .prepare(
        "INSERT INTO budgets (category_id, month, amount) VALUES (?, ?, ?)"
      )
      .run(category_id, month, amount);
    return enrich([getBudgetById(result.lastInsertRowid)])[0];
  } catch (err) {
    if (err && typeof err.code === "string" && err.code.startsWith("SQLITE_CONSTRAINT")) {
      throw new ValidationError(
        "Ya existe un presupuesto para esa categoría en ese mes."
      );
    }
    throw err;
  }
}

function updateBudget(id, fields = {}) {
  const existing = db.prepare("SELECT * FROM budgets WHERE id = ?").get(id);
  if (!existing) return null;

  const next = { ...existing, ...fields };
  validateAmount(next.amount);

  db.prepare("UPDATE budgets SET amount = ? WHERE id = ?").run(next.amount, id);
  return enrich([getBudgetById(id)])[0];
}

function deleteBudget(id) {
  const result = db.prepare("DELETE FROM budgets WHERE id = ?").run(id);
  return result.changes > 0;
}

module.exports = {
  listBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetById,
  spendByCategory,
};
