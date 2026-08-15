import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, TriangleAlert } from "lucide-react";
import {
  fetchBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
} from "../api.js";
import { currentMonthISO } from "../lib/dates.js";
import { formatMoney } from "../utils/format.js";
import { categoryIcon } from "../lib/categoryIcons.js";
import MonthNavigator from "./MonthNavigator.jsx";
import BudgetForm from "./BudgetForm.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import IconBadge from "./ui/IconBadge.jsx";
import EmptyState from "./ui/EmptyState.jsx";

const WARNING_PERCENT = 70;

function barColor(percent) {
  if (percent >= 100) return "bg-negative";
  if (percent >= WARNING_PERCENT) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function BudgetsView({ categories, onDataChanged }) {
  const [month, setMonth] = useState(currentMonthISO());
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async (m) => {
    setBudgets(await fetchBudgets({ month: m }));
  }, []);

  useEffect(() => {
    setLoading(true);
    load(month)
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [month, load]);

  const budgetCategoryIds = new Set(budgets.map((b) => b.category_id));
  const availableCategories = categories.filter(
    (c) => c.type === "gasto" && !budgetCategoryIds.has(c.id)
  );

  async function handleSave(payload) {
    if (form?.editing) {
      await updateBudget(form.editing.id, payload);
    } else {
      await createBudget({ ...payload, month });
    }
    setForm(null);
    await load(month);
    await onDataChanged?.();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const budget = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteBudget(budget.id);
      setError("");
      await load(month);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-text">Presupuestos</h2>
        <Button
          variant="primary"
          disabled={availableCategories.length === 0}
          onClick={() => setForm({ editing: null })}
          title={
            availableCategories.length === 0
              ? "Todas las categorías de gasto ya tienen presupuesto"
              : undefined
          }
        >
          <Plus size={16} />
          Asignar presupuesto
        </Button>
      </div>

      <div className="mt-4">
        <MonthNavigator month={month} onChange={setMonth} />
      </div>

      <p className="mt-4 text-sm text-text-muted">
        {availableCategories.length > 0
          ? `${availableCategories.length} categoría${
              availableCategories.length === 1 ? "" : "s"
            } de gasto sin presupuesto este mes`
          : "Todas las categorías de gasto tienen presupuesto este mes"}
      </p>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-text-muted">Cargando…</p>
      ) : budgets.length === 0 ? (
        <div className="mt-4">
          <EmptyState message="No tienes presupuestos asignados para este mes." />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
          {budgets.map((budget) => {
            const Icon = categoryIcon(budget.icon);
            return (
              <li key={budget.id} className="group flex items-center gap-4 px-4 py-4">
                <IconBadge color={budget.color} icon={Icon} size={40} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-text">
                      {budget.category}
                    </p>
                    <p
                      className={`flex shrink-0 items-center gap-1.5 font-mono text-sm font-semibold ${
                        budget.overLimit ? "text-negative" : "text-text"
                      }`}
                    >
                      {budget.overLimit && (
                        <TriangleAlert size={15} className="shrink-0" />
                      )}
                      {formatMoney(budget.spent)} de {formatMoney(budget.amount)}
                    </p>
                  </div>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${barColor(
                        budget.percent
                      )}`}
                      style={{ width: `${Math.min(budget.percent, 100)}%` }}
                    />
                  </div>

                  <p
                    className={`mt-1 text-xs ${
                      budget.overLimit
                        ? "font-medium text-negative"
                        : "text-text-muted"
                    }`}
                  >
                    {budget.overLimit
                      ? `Excedido en ${formatMoney(
                          budget.spent - budget.amount
                        )} · ${budget.percent}% del límite`
                      : `${budget.percent}% del límite`}
                  </p>
                </div>

                <div className="flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setForm({ editing: budget })}
                    title="Editar"
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(budget)}
                    title="Quitar presupuesto"
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
          title={form.editing ? "Editar presupuesto" : "Asignar presupuesto"}
          onClose={() => setForm(null)}
        >
          <BudgetForm
            categories={availableCategories}
            initial={form.editing}
            onSubmit={handleSave}
            onCancel={() => setForm(null)}
          />
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`¿Quitar el presupuesto de "${pendingDelete.category}"?`}
          message="Se quitará el presupuesto asignado a esta categoría."
          confirmText="Quitar"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
