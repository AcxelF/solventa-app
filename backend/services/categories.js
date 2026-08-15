const db = require("../db");
const { ValidationError } = require("./errors");

const VALID_TYPES = ["ingreso", "gasto"];
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function getCategoryById(id) {
  return db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
}

function listCategories({ type } = {}) {
  if (type) {
    return db
      .prepare("SELECT * FROM categories WHERE type = ? ORDER BY name COLLATE NOCASE")
      .all(type);
  }
  return db
    .prepare("SELECT * FROM categories ORDER BY type, name COLLATE NOCASE")
    .all();
}

function validateCategory({ name, type, icon, color }) {
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new ValidationError("El nombre de la categoría es obligatorio.");
  }
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError("El tipo debe ser 'ingreso' o 'gasto'.");
  }
  if (!icon || typeof icon !== "string" || icon.trim() === "") {
    throw new ValidationError("Debes elegir un ícono para la categoría.");
  }
  if (!color || typeof color !== "string" || !HEX_COLOR.test(color)) {
    throw new ValidationError("El color debe ser un hex válido (ej: #3498DB).");
  }
}

function isUniqueConstraint(err) {
  return err && typeof err.code === "string" && err.code.startsWith("SQLITE_CONSTRAINT");
}

function createCategory({ name, type, icon, color } = {}) {
  validateCategory({ name, type, icon, color });

  try {
    const result = db
      .prepare(
        "INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?)"
      )
      .run(name.trim(), type, icon, color);
    return getCategoryById(result.lastInsertRowid);
  } catch (err) {
    if (isUniqueConstraint(err)) {
      throw new ValidationError("Ya existe una categoría con ese nombre y tipo.");
    }
    throw err;
  }
}

function updateCategory(id, fields = {}) {
  const existing = getCategoryById(id);
  if (!existing) return null;

  const next = { ...existing, ...fields };
  validateCategory(next);

  try {
    db.prepare(
      "UPDATE categories SET name = ?, type = ?, icon = ?, color = ? WHERE id = ?"
    ).run(next.name.trim(), next.type, next.icon, next.color, id);
  } catch (err) {
    if (isUniqueConstraint(err)) {
      throw new ValidationError("Ya existe una categoría con ese nombre y tipo.");
    }
    throw err;
  }

  return getCategoryById(id);
}

function deleteCategory(id) {
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?")
    .get(id).n;
  if (count > 0) {
    throw new ValidationError(
      "No puedes eliminar una categoría que está en uso por algún movimiento."
    );
  }

  const result = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  return result.changes > 0;
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryById,
};
