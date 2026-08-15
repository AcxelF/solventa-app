// Migra los datos del SQLite local (data.db) a la base de datos de Turso.
//
// Lee cada tabla del archivo local con better-sqlite3 y la inserta en Turso
// preservando los IDs, de modo que las relaciones entre tablas se mantienen
// (p. ej. las transacciones siguen apuntando a la misma cuenta y categoría).
//
// Requisitos: tener TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en el .env
// (la base de Turso debe estar vacía o sin los mismos registros).
//
// Uso:
//   node migrate-to-turso.js
const path = require("path");
const Database = require("better-sqlite3");
const db = require("./db");

// Orden de inserción respetando las llaves foráneas:
// primero las tablas sin dependencias y al final las que referencian otras.
const TABLES = [
  "accounts",
  "categories",
  "transactions",
  "budgets",
  "savings_goals",
  "savings_contributions",
];

const local = new Database(path.join(__dirname, "data.db"));

function readRows(table) {
  return local.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
}

async function migrateTable(table) {
  const rows = readRows(table);
  if (!rows.length) {
    console.log(`  ${table}: 0 filas (vacío)`);
    return 0;
  }

  const columns = Object.keys(rows[0]);
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  const statements = rows.map((row) => ({
    sql,
    args: columns.map((c) => row[c]),
  }));

  // Inserta en bloques atómicos para evitar cargar todo en una sola petición.
  const BATCH_SIZE = 100;
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await db.batch(statements.slice(i, i + BATCH_SIZE));
  }

  console.log(`  ${table}: ${rows.length} filas`);
  return rows.length;
}

(async () => {
  try {
    console.log("Creando schema en Turso (tablas + migraciones)...");
    await db.ensureSchema();

    console.log("Copiando datos:");
    let total = 0;
    for (const table of TABLES) {
      total += await migrateTable(table);
    }
    console.log(`\nMigración completada: ${total} filas en total.`);

    console.log("\nVerificación de conteos en Turso:");
    for (const table of TABLES) {
      const { rows } = await db.execute(`SELECT COUNT(*) AS n FROM ${table}`);
      console.log(`  ${table}: ${rows[0].n}`);
    }
  } catch (err) {
    console.error("\nError durante la migración:", err);
    process.exitCode = 1;
  } finally {
    local.close();
  }
})();
