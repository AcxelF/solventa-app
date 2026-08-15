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

function ensureCategory() {
  let category = db
    .prepare("SELECT * FROM categories WHERE name = ? AND type = 'gasto'")
    .get(CATEGORY_NAME);
  if (!category) {
    const result = db
      .prepare(
        "INSERT INTO categories (name, type, icon, color) VALUES (?, 'gasto', 'utensils', '#E67E22')"
      )
      .run(CATEGORY_NAME);
    category = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(result.lastInsertRowid);
    console.log(`Categoría creada: "${category.name}" (id ${category.id})`);
  } else {
    console.log(`Categoría reutilizada: "${category.name}" (id ${category.id})`);
  }
  return category;
}

function ensureAccount() {
  let account = db
    .prepare("SELECT * FROM accounts WHERE name = ? AND type = ?")
    .get(ACCOUNT_NAME, ACCOUNT_TYPE);
  if (!account) {
    const result = db
      .prepare(
        "INSERT INTO accounts (name, type, color) VALUES (?, ?, ?)"
      )
      .run(ACCOUNT_NAME, ACCOUNT_TYPE, ACCOUNT_COLOR);
    account = db
      .prepare("SELECT * FROM accounts WHERE id = ?")
      .get(result.lastInsertRowid);
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

function seed() {
  const category = ensureCategory();
  const account = ensureAccount();

  // Borra transacciones previas del script para que los totales sean exactos.
  const deletedTxns = db
    .prepare("DELETE FROM transactions WHERE account_id = ?")
    .run(account.id).changes;

  const insertTxn = db.prepare(
    `INSERT INTO transactions (account_id, category_id, type, amount, description, date)
     VALUES (?, ?, 'gasto', ?, ?, ?)`
  );

  const upsertBudget = db.prepare(
    `INSERT INTO budgets (category_id, month, amount)
     VALUES (?, ?, ?)
     ON CONFLICT (category_id, month) DO UPDATE SET amount = excluded.amount`
  );

  const run = db.transaction(() => {
    for (const [date, amount] of TXNS) {
      insertTxn.run(account.id, category.id, amount, DESCRIPTION_PREFIX, date);
    }
    for (const { month } of MONTHS) {
      upsertBudget.run(category.id, month, LIMIT);
    }
  });
  run();

  console.log(`\nTransacciones previas del script borradas: ${deletedTxns}`);
  console.log(`Transacciones insertadas: ${TXNS.length}`);
  console.log(`Presupuestos de S/ ${LIMIT} (upsert): ${MONTHS.map((m) => m.month).join(", ")}`);

  console.log("\nVerificación por mes (categoría " + CATEGORY_NAME + "):");
  for (const { month, label, total } of MONTHS) {
    const { spent } = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS spent FROM transactions
         WHERE category_id = ? AND type = 'gasto' AND substr(date, 1, 7) = ?`
      )
      .get(category.id, month);
    const mark = spent > LIMIT ? "SE PASÓ del límite (corta la racha)" : "dentro del límite";
    console.log(`  ${label}: S/ ${spent} / ${LIMIT} → ${mark}`);
  }

  const streak = dashboardService.getBudgetStreak();
  console.log(
    `\nResultado esperado en el dashboard — Racha: ${streak.months} mes${
      streak.months === 1 ? "" : "es"
    }${streak.category ? ` (${streak.category})` : ""}`
  );

  // Verificación end-to-end contra la API si el backend está arriba.
  (async () => {
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
  })();
}

function clean() {
  const category = db
    .prepare("SELECT id FROM categories WHERE name = ? AND type = 'gasto'")
    .get(CATEGORY_NAME);
  const account = db
    .prepare("SELECT * FROM accounts WHERE name = ? AND type = ?")
    .get(ACCOUNT_NAME, ACCOUNT_TYPE);

  const run = db.transaction(() => {
    if (account) {
      db.prepare("DELETE FROM transactions WHERE account_id = ?").run(account.id);
      db.prepare("DELETE FROM accounts WHERE id = ?").run(account.id);
    }
    if (category) {
      for (const { month } of MONTHS) {
        db.prepare("DELETE FROM budgets WHERE category_id = ? AND month = ?").run(
          category.id,
          month
        );
      }
    }
  });
  run();

  console.log("Datos de prueba eliminados:");
  if (account) console.log(`  - Cuenta "${ACCOUNT_NAME}" y sus movimientos`);
  if (category)
    console.log(
      `  - Presupuestos de "${CATEGORY_NAME}" en ${MONTHS.map((m) => m.month).join(", ")}`
    );
}

if (process.argv.includes("--clean")) {
  clean();
} else {
  seed();
}
