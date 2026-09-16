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

async function getAccountById(id) {
  return db.get("SELECT * FROM accounts WHERE id = ?", [id]);
}

async function getBalance(accountId) {
  const row = await db.get(
    `SELECT
       (SELECT initial_balance FROM accounts WHERE id = ?) +
       COALESCE((SELECT SUM(CASE WHEN type = 'ingreso' THEN amount ELSE -amount END)
                 FROM transactions WHERE account_id = ?), 0) AS balance`,
    [accountId, accountId]
  );
  return row.balance;
}

async function withBalance(account) {
  return account ? { ...account, balance: await getBalance(account.id) } : null;
}

async function listAccounts() {
  const rows = await db.all("SELECT * FROM accounts ORDER BY id");
  const withBalances = [];
  for (const account of rows) {
    withBalances.push(await withBalance(account));
  }
  return withBalances;
}

function validateAccount({ name, type, color, initial_balance }) {
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new ValidationError("El nombre de la cuenta es obligatorio.");
  }
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError("El tipo de cuenta no es válido.");
  }
  if (!color || typeof color !== "string" || !HEX_COLOR.test(color)) {
    throw new ValidationError("El color debe ser un hex válido (ej: #7C3AED).");
  }
  if (
    initial_balance !== undefined &&
    initial_balance !== null &&
    (typeof initial_balance !== "number" || !Number.isFinite(initial_balance))
  ) {
    throw new ValidationError("El saldo inicial debe ser un número.");
  }
}

async function createAccount({ name, type, color, icon_url, initial_balance } = {}) {
  validateAccount({ name, type, color, initial_balance });

  const result = await db.run(
    "INSERT INTO accounts (name, type, color, icon_url, initial_balance) VALUES (?, ?, ?, ?, ?)",
    [name.trim(), type, color, icon_url || null, initial_balance ?? 0]
  );

  return withBalance(await getAccountById(result.lastInsertRowid));
}

async function updateAccount(id, fields = {}) {
  const existing = await getAccountById(id);
  if (!existing) return null;

  const next = { ...existing, ...fields };
  validateAccount(next);

  await db.run(
    "UPDATE accounts SET name = ?, type = ?, color = ?, icon_url = ?, initial_balance = ? WHERE id = ?",
    [next.name.trim(), next.type, next.color, next.icon_url || null, next.initial_balance ?? 0, id]
  );

  return withBalance(await getAccountById(id));
}

async function deleteAccount(id) {
  const count = await db.get(
    "SELECT COUNT(*) AS n FROM transactions WHERE account_id = ?",
    [id]
  );
  if (count.n > 0) {
    throw new ValidationError(
      "No puedes eliminar una cuenta que tiene movimientos asociados."
    );
  }

  const result = await db.run("DELETE FROM accounts WHERE id = ?", [id]);
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
