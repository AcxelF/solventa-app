// Seed de prueba para verificar la "Racha de presupuesto" del dashboard.
// Uso:  node seed-test-racha.js        (inserta los datos)
//       node seed-test-racha.js --clean  (borra los datos de prueba)
//
// Inserta presupuestos de S/ 300 en Alimentación para Mayo-Julio-Agosto 2026
// y gastos por mes: Mayo 250, Junio 280 (dentro), Julio 320 (se pasa),
// Agosto 100 (dentro). La racha esperada es de 1 mes (Agosto), porque
// julio rompió la cadena.
const db = require("./db");
const dashboardService = require("./services/dashboard");

const CATEGORY_NAME = "Alimentación";
const ACCOUNT_NAME = "Prueba Racha";
const ACCOUNT_TYPE = "Otro";
const ACCOUNT_COLOR = "#7C3AED";
const LIMIT = 300;
const DESCRIPTION_PREFIX = "Seed racha";

const MONTHS = [
  { month: "2026-05", label: "Mayo 2026", total: 250 },
  { month: "2026-06", label: "Junio 2026", total: 280 },
  { month: "2026-07", label: "Julio 2026", total: 320 },
  { month: "2026-08", label: "Agosto 2026", total: 100 },
];

async function ensureCategory() {
  let category = await db.get(
    "SELECT * FROM categories WHERE name = ? AND type = 'gasto'",
    [CATEGORY_NAME]
  );
  if (!category) {
    const result = await db.run(
      "INSERT INTO categories (name, type, icon, color) VALUES (?, 'gasto', 'utensils', '#E67E22')",
      [CATEGORY_NAME]
    );
    category = await db.get("SELECT * FROM categories WHERE id = ?", [
      result.lastInsertRowid,
    ]);
    console.log(`Categoría creada: "${category.name}" (id ${category.id})`);
  } else {
    console.log(`Categoría reutilizada: "${category.name}" (id ${category.id})`);
  }
  return category;
}

async function ensureAccount() {
  let account = await db.get(
    "SELECT * FROM accounts WHERE name = ? AND type = ?",
    [ACCOUNT_NAME, ACCOUNT_TYPE]
  );
  if (!account) {
    const result = await db.run(
      "INSERT INTO accounts (name, type, color) VALUES (?, ?, ?)",
      [ACCOUNT_NAME, ACCOUNT_TYPE, ACCOUNT_COLOR]
    );
    account = await db.get("SELECT * FROM accounts WHERE id = ?", [
      result.lastInsertRowid,
    ]);
    console.log(`Cuenta creada: "${account.name}" (id ${account.id})`);
  } else {
    console.log(`Cuenta reutilizada: "${account.name}" (id ${account.id})`);
  }
  return account;
}

// Fechas internas por mes: varias transacciones por mes, sumando "total".
const TXNS = [
  ["2026-05-10", 150],
  ["2026-05-21", 100],
  ["2026-06-06", 140],
  ["2026-06-19", 140],
  ["2026-07-08", 320],
  ["2026-08-04", 100],
];

async function seed() {
  const category = await ensureCategory();
  const account = await ensureAccount();

  // Borra transacciones previas del script para que los totales sean exactos.
  const deleted = await db.run(
    "DELETE FROM transactions WHERE account_id = ?",
    [account.id]
  );
  const deletedTxns = deleted.changes;

  const txnStatements = TXNS.map(([date, amount]) => ({
    sql:
      "INSERT INTO transactions (account_id, category_id, type, amount, description, date) VALUES (?, ?, 'gasto', ?, ?, ?)",
    args: [account.id, category.id, amount, DESCRIPTION_PREFIX, date],
  }));

  const budgetStatements = MONTHS.map(({ month }) => ({
    sql:
      "INSERT INTO budgets (category_id, month, amount) VALUES (?, ?, ?) ON CONFLICT (category_id, month) DO UPDATE SET amount = excluded.amount",
    args: [category.id, month, LIMIT],
  }));

  await db.batch([...txnStatements, ...budgetStatements]);

  console.log(`\nTransacciones previas del script borradas: ${deletedTxns}`);
  console.log(`Transacciones insertadas: ${TXNS.length}`);
  console.log(`Presupuestos de S/ ${LIMIT} (upsert): ${MONTHS.map((m) => m.month).join(", ")}`);

  console.log("\nVerificación por mes (categoría " + CATEGORY_NAME + "):");
  for (const { month, label, total } of MONTHS) {
    const row = await db.get(
      `SELECT COALESCE(SUM(amount), 0) AS spent FROM transactions
       WHERE category_id = ? AND type = 'gasto' AND substr(date, 1, 7) = ?`,
      [category.id, month]
    );
    const mark = row.spent > LIMIT ? "SE PASÓ del límite (corta la racha)" : "dentro del límite";
    console.log(`  ${label}: S/ ${row.spent} / ${LIMIT} → ${mark}`);
  }

  const streak = await dashboardService.getBudgetStreak();
  console.log(
    `\nResultado esperado en el dashboard — Racha: ${streak.months} mes${
      streak.months === 1 ? "" : "es"
    }${streak.category ? ` (${streak.category})` : ""}`
  );

  // Verificación end-to-end contra la API si el backend está arriba.
  try {
    const res = await fetch("http://localhost:3001/api/dashboard/widgets");
    const data = await res.json();
    const s = data.budget_streak;
    console.log(
      `API /api/dashboard/widgets → racha: ${s.months} mes${
        s.months === 1 ? "" : "es"
      }${s.category ? ` (${s.category})` : ""}`
    );
  } catch {
    console.log(
      "\n(El backend no responde en :3001 — el cálculo del servicio ya se mostró arriba.)"
    );
  }
}

async function clean() {
  const category = await db.get(
    "SELECT id FROM categories WHERE name = ? AND type = 'gasto'",
    [CATEGORY_NAME]
  );
  const account = await db.get(
    "SELECT * FROM accounts WHERE name = ? AND type = ?",
    [ACCOUNT_NAME, ACCOUNT_TYPE]
  );

  const statements = [];
  if (account) {
    statements.push({
      sql: "DELETE FROM transactions WHERE account_id = ?",
      args: [account.id],
    });
    statements.push({ sql: "DELETE FROM accounts WHERE id = ?", args: [account.id] });
  }
  if (category) {
    for (const { month } of MONTHS) {
      statements.push({
        sql: "DELETE FROM budgets WHERE category_id = ? AND month = ?",
        args: [category.id, month],
      });
    }
  }
  if (statements.length) {
    await db.batch(statements);
  }

  console.log("Datos de prueba eliminados:");
  if (account) console.log(`  - Cuenta "${ACCOUNT_NAME}" y sus movimientos`);
  if (category)
    console.log(
      `  - Presupuestos de "${CATEGORY_NAME}" en ${MONTHS.map((m) => m.month).join(", ")}`
    );
}

(async () => {
  if (process.argv.includes("--clean")) {
    await clean();
  } else {
    await seed();
  }
})();
