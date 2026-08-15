require("dotenv").config();
const { createClient } = require("@libsql/client");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const isFileUrl = typeof url === "string" && url.startsWith("file:");

if (!url) {
  throw new Error(
    "Falta TURSO_DATABASE_URL en las variables de entorno (.env)."
  );
}
if (!isFileUrl && !authToken) {
  throw new Error(
    "Falta TURSO_AUTH_TOKEN en las variables de entorno (.env)."
  );
}

const db = createClient({ url, authToken });

// Helpers asíncronos con una API parecida a better-sqlite3 (get/all/run),
// para que los servicios mantengan el mismo estilo de consulta.
async function get(sql, args = []) {
  const { rows } = await db.execute({ sql, args });
  return rows[0];
}

async function all(sql, args = []) {
  const { rows } = await db.execute({ sql, args });
  return rows;
}

async function run(sql, args = []) {
  const result = await db.execute({ sql, args });
  return {
    changes: Number(result.rowsAffected),
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (
      type IN ('Efectivo', 'Yape', 'Plin', 'BCP', 'BBVA', 'Interbank', 'Scotiabank', 'Falabella', 'Tarjeta de crédito', 'Otro')
    ),
    color TEXT NOT NULL,
    icon_url TEXT,
    brand TEXT,
    last_four TEXT,
    credit_limit REAL,
    cut_day INTEGER,
    payment_day INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ingreso', 'gasto')),
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (name, type)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('ingreso', 'gasto')),
    amount REAL NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (category_id, month)
  );

  CREATE TABLE IF NOT EXISTS savings_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    deadline TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS savings_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// Crea las tablas (y aplica migraciones de columnas) si no existen.
async function ensureSchema() {
  await db.executeMultiple(SCHEMA);
  await migrate();
}

// Inicializa el schema y además siembra las categorías de fábrica.
// Llamarlo una sola vez al arrancar el servidor.
async function init() {
  await ensureSchema();
  await seedFactoryCategories();
}

async function migrate() {
  const columns = (await all("PRAGMA table_info(accounts)")).map(
    (column) => column.name
  );

  const additions = [
    ["brand", "TEXT"],
    ["last_four", "TEXT"],
    ["credit_limit", "REAL"],
    ["cut_day", "INTEGER"],
    ["payment_day", "INTEGER"],
  ];

  for (const [name, type] of additions) {
    if (!columns.includes(name)) {
      await run(`ALTER TABLE accounts ADD COLUMN ${name} ${type}`);
    }
  }
}

async function seedFactoryCategories() {
  const factory = [
    { name: "Alimentación", type: "gasto", icon: "utensils", color: "#E67E22" },
    { name: "Transporte", type: "gasto", icon: "car", color: "#3498DB" },
    { name: "Vivienda", type: "gasto", icon: "home", color: "#9B59B6" },
    { name: "Entretenimiento", type: "gasto", icon: "gamepad2", color: "#E74C3C" },
    { name: "Salud", type: "gasto", icon: "heart-pulse", color: "#1ABC9C" },
    { name: "Educación", type: "gasto", icon: "graduation-cap", color: "#F39C12" },
    { name: "Otros", type: "gasto", icon: "more-horizontal", color: "#95A5A6" },
    { name: "Sueldo", type: "ingreso", icon: "wallet", color: "#2E7D5B" },
    { name: "Freelance", type: "ingreso", icon: "laptop", color: "#16A085" },
    { name: "Regalo", type: "ingreso", icon: "gift", color: "#E84393" },
    { name: "Otros", type: "ingreso", icon: "tag", color: "#7F8C8D" },
  ];

  for (const c of factory) {
    await run(
      "INSERT OR IGNORE INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?)",
      [c.name, c.type, c.icon, c.color]
    );
  }
}

db.get = get;
db.all = all;
db.run = run;
db.init = init;
db.ensureSchema = ensureSchema;
db.SCHEMA = SCHEMA;

module.exports = db;
