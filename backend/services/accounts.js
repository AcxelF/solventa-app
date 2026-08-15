const db = require("../db");
const { ValidationError } = require("./errors");

const VALID_TYPES = [
  "Efectivo",
  "Yape",
  "Plin",
  "BCP",
  "BBVA",
  "Interbank",
  "Scotiabank",
  "Falabella",
  "Tarjeta de crédito",
  "Otro",
];

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function getAccountById(id) {
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
}

function getBalance(accountId) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE -amount END), 0) AS balance
       FROM transactions WHERE account_id = ?`
    )
    .get(accountId);
  return row.balance;
}

function withBalance(account) {
  return account ? { ...account, balance: getBalance(account.id) } : null;
}

function listAccounts() {
  const rows = db.prepare("SELECT * FROM accounts ORDER BY id").all();
  return rows.map(withBalance);
}

function validateAccount({ name, type, color }) {
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new ValidationError("El nombre de la cuenta es obligatorio.");
  }
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError("El tipo de cuenta no es válido.");
  }
  if (!color || typeof color !== "string" || !HEX_COLOR.test(color)) {
    throw new ValidationError("El color debe ser un hex válido (ej: #7C3AED).");
  }
}

function createAccount({ name, type, color, icon_url } = {}) {
  validateAccount({ name, type, color });

  const result = db
    .prepare(
      "INSERT INTO accounts (name, type, color, icon_url) VALUES (?, ?, ?, ?)"
    )
    .run(name.trim(), type, color, icon_url || null);

  return withBalance(getAccountById(result.lastInsertRowid));
}

function updateAccount(id, fields = {}) {
  const existing = getAccountById(id);
  if (!existing) return null;

  const next = { ...existing, ...fields };
  validateAccount(next);

  db.prepare(
    "UPDATE accounts SET name = ?, type = ?, color = ?, icon_url = ? WHERE id = ?"
  ).run(next.name.trim(), next.type, next.color, next.icon_url || null, id);

  return withBalance(getAccountById(id));
}

function deleteAccount(id) {
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM transactions WHERE account_id = ?")
    .get(id).n;
  if (count > 0) {
    throw new ValidationError(
      "No puedes eliminar una cuenta que tiene movimientos asociados."
    );
  }

  const result = db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
  return result.changes > 0;
}

module.exports = {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountById,
  getBalance,
};
