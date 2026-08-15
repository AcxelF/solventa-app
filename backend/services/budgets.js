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

async function getBudgetById(id) {
  return db.get(`${SELECT_JOINED} WHERE b.id = ?`, [id]);
}

async function spendByCategory(months) {
  const map = new Map();
  for (const month of new Set(months)) {
    const summary = await transactionsService.getSummary({ month });
    for (const row of summary.byCategory) {
      map.set(`${month}:${row.category_id}`, row.total);
    }
  }
  return map;
}

async function enrich(budgets) {
  if (!budgets.length) return [];
  const spend = await spendByCategory(budgets.map((b) => b.month));
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

async function listBudgets({ month } = {}) {
  if (month) validateMonth(month);
  const budgets = month
    ? await db.all(
        `${SELECT_JOINED} WHERE b.month = ? ORDER BY c.name COLLATE NOCASE`,
        [month]
      )
    : await db.all(`${SELECT_JOINED} ORDER BY b.month DESC, c.name COLLATE NOCASE`);
  return enrich(budgets);
}

async function createBudget({ category_id, month, amount } = {}) {
  validateMonth(month);
  validateAmount(amount);
  if (!Number.isInteger(category_id)) {
    throw new ValidationError("La categoría es obligatoria.");
  }

  const category = await db.get("SELECT id, type FROM categories WHERE id = ?", [
    category_id,
  ]);
  if (!category) {
    throw new ValidationError("La categoría seleccionada no existe.");
  }
  if (category.type !== "gasto") {
    throw new ValidationError(
      "Solo puedes asignar presupuesto a categorías de gasto."
    );
  }

  try {
    const result = await db.run(
      "INSERT INTO budgets (category_id, month, amount) VALUES (?, ?, ?)",
      [category_id, month, amount]
    );
    const created = await getBudgetById(result.lastInsertRowid);
    return (await enrich([created]))[0];
  } catch (err) {
    if (err && typeof err.code === "string" && err.code.startsWith("SQLITE_CONSTRAINT")) {
      throw new ValidationError(
        "Ya existe un presupuesto para esa categoría en ese mes."
      );
    }
    throw err;
  }
}

async function updateBudget(id, fields = {}) {
  const existing = await db.get("SELECT * FROM budgets WHERE id = ?", [id]);
  if (!existing) return null;

  const next = { ...existing, ...fields };
  validateAmount(next.amount);

  await db.run("UPDATE budgets SET amount = ? WHERE id = ?", [next.amount, id]);
  const updated = await getBudgetById(id);
  return (await enrich([updated]))[0];
}

async function deleteBudget(id) {
  const result = await db.run("DELETE FROM budgets WHERE id = ?", [id]);
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
