const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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
`);

migrate();

function migrate() {
  const columns = db
    .prepare("PRAGMA table_info(accounts)")
    .all()
    .map((column) => column.name);

  const additions = [
    ["brand", "TEXT"],
    ["last_four", "TEXT"],
    ["credit_limit", "REAL"],
    ["cut_day", "INTEGER"],
    ["payment_day", "INTEGER"],
  ];

  for (const [name, type] of additions) {
    if (!columns.includes(name)) {
      db.exec(`ALTER TABLE accounts ADD COLUMN ${name} ${type}`);
    }
  }
}

seedFactoryCategories();

function seedFactoryCategories() {
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

  const insert = db.prepare(
    "INSERT OR IGNORE INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?)"
  );
  for (const c of factory) insert.run(c.name, c.type, c.icon, c.color);
}

module.exports = db;
