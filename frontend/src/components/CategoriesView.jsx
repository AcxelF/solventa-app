import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { categoryIcon } from "../lib/categoryIcons.js";
import { createCategory, updateCategory, deleteCategory } from "../api.js";
import CategoryForm from "./CategoryForm.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import IconBadge from "./ui/IconBadge.jsx";
import EmptyState from "./ui/EmptyState.jsx";

const TABS = [
  { value: "gasto", label: "Gastos" },
  { value: "ingreso", label: "Ingresos" },
];

export default function CategoriesView({ categories, onDataChanged }) {
  const [tab, setTab] = useState("gasto");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  const visible = categories.filter((c) => c.type === tab);

  async function handleSave(payload) {
    if (form?.editing) {
      await updateCategory(form.editing.id, payload);
    } else {
      await createCategory(payload);
    }
    setForm(null);
    await onDataChanged();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const category = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteCategory(category.id);
      setError("");
      await onDataChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-text">Categorías</h2>
        <Button
          variant="primary"
          onClick={() => setForm({ editing: null, type: tab })}
        >
          <Plus size={16} />
          Nueva categoría
        </Button>
      </div>

      <div className="mt-4 flex w-fit gap-1 rounded-full bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              tab === t.value
                ? "bg-bg font-medium text-text shadow-sm"
                : "text-text-secondary hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="No hay categorías de este tipo todavía." />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
          {visible.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <li
                key={category.id}
                className="group flex items-center gap-4 px-4 py-3"
              >
                <IconBadge color={category.color} icon={Icon} size={36} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {category.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {category.type === "gasto" ? "Gasto" : "Ingreso"}
                  </p>
                </div>

                <div className="flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setForm({ editing: category })}
                    title="Editar"
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(category)}
                    title="Eliminar"
                    className="rounded-md p-1.5 text-text-muted hover:bg-negative/10 hover:text-negative"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <Modal
          title={form.editing ? "Editar categoría" : "Nueva categoría"}
          onClose={() => setForm(null)}
        >
          <CategoryForm
            initial={form.editing}
            typeProp={form.editing ? form.editing.type : form.type}
            onSubmit={handleSave}
            onCancel={() => setForm(null)}
          />
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`¿Eliminar la categoría "${pendingDelete.name}"?`}
          message="Esta acción no se puede deshacer."
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
