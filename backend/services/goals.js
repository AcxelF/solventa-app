const db = require("../db");
const { ValidationError } = require("./errors");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateName(name) {
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new ValidationError("El nombre de la meta es obligatorio.");
  }
}

function validateTargetAmount(targetAmount) {
  if (
    typeof targetAmount !== "number" ||
    !Number.isFinite(targetAmount) ||
    targetAmount <= 0
  ) {
    throw new ValidationError("El monto objetivo debe ser un número mayor a 0.");
  }
}

function validateDeadline(deadline) {
  if (deadline === null || deadline === undefined || deadline === "") return;
  if (typeof deadline !== "string" || !DATE_RE.test(deadline)) {
    throw new ValidationError("La fecha límite debe tener formato YYYY-MM-DD.");
  }
}

function validateAmount(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError("El monto del aporte debe ser un número mayor a 0.");
  }
}

function validateDate(date) {
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    throw new ValidationError("La fecha debe tener formato YYYY-MM-DD.");
  }
}

async function getGoal(id) {
  return db.get("SELECT * FROM savings_goals WHERE id = ?", [id]);
}

async function getGoalCurrentAmount(goalId) {
  const row = await db.get(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM savings_contributions WHERE goal_id = ?",
    [goalId]
  );
  return row.total;
}

async function withProgress(goal) {
  if (!goal) return null;
  const currentAmount = await getGoalCurrentAmount(goal.id);
  return {
    ...goal,
    current_amount: currentAmount,
    percent:
      goal.target_amount > 0
        ? Math.round((currentAmount / goal.target_amount) * 100)
        : 0,
    completed: currentAmount >= goal.target_amount,
  };
}

async function listGoals() {
  const goals = await db.all("SELECT * FROM savings_goals ORDER BY id");
  const withProgressList = [];
  for (const goal of goals) {
    withProgressList.push(await withProgress(goal));
  }
  return withProgressList;
}

async function createGoal({ name, target_amount, deadline } = {}) {
  validateName(name);
  validateTargetAmount(target_amount);
  validateDeadline(deadline);

  const result = await db.run(
    "INSERT INTO savings_goals (name, target_amount, deadline) VALUES (?, ?, ?)",
    [name.trim(), target_amount, deadline || null]
  );

  return withProgress(await getGoal(result.lastInsertRowid));
}

async function updateGoal(id, fields = {}) {
  const existing = await getGoal(id);
  if (!existing) return null;

  const next = { ...existing, ...fields };
  validateName(next.name);
  validateTargetAmount(next.target_amount);
  validateDeadline(next.deadline);

  await db.run(
    "UPDATE savings_goals SET name = ?, target_amount = ?, deadline = ? WHERE id = ?",
    [next.name.trim(), next.target_amount, next.deadline || null, id]
  );

  return withProgress(await getGoal(id));
}

async function deleteGoal(id) {
  const result = await db.run("DELETE FROM savings_goals WHERE id = ?", [id]);
  return result.changes > 0;
}

async function listContributions(goalId) {
  if (!(await getGoal(goalId))) {
    throw new ValidationError("La meta no existe.");
  }
  return db.all(
    "SELECT * FROM savings_contributions WHERE goal_id = ? ORDER BY date DESC, id DESC",
    [goalId]
  );
}

async function addContribution(goalId, { amount, date, note } = {}) {
  if (!(await getGoal(goalId))) {
    throw new ValidationError("La meta no existe.");
  }
  validateAmount(amount);
  validateDate(date);

  const result = await db.run(
    "INSERT INTO savings_contributions (goal_id, amount, date, note) VALUES (?, ?, ?, ?)",
    [goalId, amount, date, note || null]
  );

  return db.get("SELECT * FROM savings_contributions WHERE id = ?", [
    result.lastInsertRowid,
  ]);
}

async function deleteContribution(id) {
  const result = await db.run("DELETE FROM savings_contributions WHERE id = ?", [id]);
  return result.changes > 0;
}

async function getGoalWithProgress(id) {
  return withProgress(await getGoal(id));
}

module.exports = {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getGoal: getGoalWithProgress,
  listContributions,
  addContribution,
  deleteContribution,
};
