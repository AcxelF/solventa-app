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

function getGoal(id) {
  return db.prepare("SELECT * FROM savings_goals WHERE id = ?").get(id);
}

function getGoalCurrentAmount(goalId) {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM savings_contributions WHERE goal_id = ?"
    )
    .get(goalId);
  return row.total;
}

function withProgress(goal) {
  if (!goal) return null;
  const currentAmount = getGoalCurrentAmount(goal.id);
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

function listGoals() {
  const goals = db.prepare("SELECT * FROM savings_goals ORDER BY id").all();
  return goals.map(withProgress);
}

function createGoal({ name, target_amount, deadline } = {}) {
  validateName(name);
  validateTargetAmount(target_amount);
  validateDeadline(deadline);

  const result = db
    .prepare(
      "INSERT INTO savings_goals (name, target_amount, deadline) VALUES (?, ?, ?)"
    )
    .run(name.trim(), target_amount, deadline || null);

  return withProgress(getGoal(result.lastInsertRowid));
}

function updateGoal(id, fields = {}) {
  const existing = getGoal(id);
  if (!existing) return null;

  const next = { ...existing, ...fields };
  validateName(next.name);
  validateTargetAmount(next.target_amount);
  validateDeadline(next.deadline);

  db.prepare(
    "UPDATE savings_goals SET name = ?, target_amount = ?, deadline = ? WHERE id = ?"
  ).run(next.name.trim(), next.target_amount, next.deadline || null, id);

  return withProgress(getGoal(id));
}

function deleteGoal(id) {
  const result = db.prepare("DELETE FROM savings_goals WHERE id = ?").run(id);
  return result.changes > 0;
}

function listContributions(goalId) {
  if (!getGoal(goalId)) {
    throw new ValidationError("La meta no existe.");
  }
  return db
    .prepare(
      "SELECT * FROM savings_contributions WHERE goal_id = ? ORDER BY date DESC, id DESC"
    )
    .all(goalId);
}

function addContribution(goalId, { amount, date, note } = {}) {
  if (!getGoal(goalId)) {
    throw new ValidationError("La meta no existe.");
  }
  validateAmount(amount);
  validateDate(date);

  const result = db
    .prepare(
      "INSERT INTO savings_contributions (goal_id, amount, date, note) VALUES (?, ?, ?, ?)"
    )
    .run(goalId, amount, date, note || null);

  return db
    .prepare("SELECT * FROM savings_contributions WHERE id = ?")
    .get(result.lastInsertRowid);
}

function deleteContribution(id) {
  const result = db
    .prepare("DELETE FROM savings_contributions WHERE id = ?")
    .run(id);
  return result.changes > 0;
}

function getGoalWithProgress(id) {
  return withProgress(getGoal(id));
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
