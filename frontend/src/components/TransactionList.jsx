import { Pencil, Trash2 } from "lucide-react";
import { categoryIcon } from "../lib/categoryIcons.js";
import { formatMoney } from "../utils/format.js";
import IconBadge from "./ui/IconBadge.jsx";
import EmptyState from "./ui/EmptyState.jsx";

export default function TransactionList({
  transactions,
  loading,
  onEdit,
  onDelete,
  emptyMessage = "No hay movimientos este mes.",
}) {
  if (loading) {
    return <p className="text-sm text-text-muted">Cargando movimientos…</p>;
  }

  if (!transactions.length) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {transactions.map((t) => {
        const Icon = categoryIcon(t.category_icon);
        const isIngreso = t.type === "ingreso";
        return (
          <li key={t.id} className="group flex items-center gap-3 px-4 py-3">
            <IconBadge color={t.category_color} icon={Icon} size={36} />

            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium text-text">
                {t.category_name}
              </p>
              <p className="break-words text-xs text-text-muted">
                {t.description ? `${t.description} · ` : ""}
                {t.date} · {t.account_name}
              </p>
            </div>

            <span
              className={`shrink-0 font-mono text-sm font-semibold ${
                isIngreso ? "text-positive" : "text-negative"
              }`}
            >
              {isIngreso ? "+" : "−"}
              {formatMoney(t.amount)}
            </span>

            <div className="flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onEdit(t)}
                title="Editar"
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(t.id)}
                title="Borrar"
                className="rounded-md p-1.5 text-text-muted hover:bg-negative/10 hover:text-negative"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
