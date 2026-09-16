import { Pencil, Trash2 } from "lucide-react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import { categoryIcon } from "../lib/categoryIcons.js";
import { formatMoney } from "../utils/format.js";
import IconBadge from "./ui/IconBadge.jsx";
import EmptyState from "./ui/EmptyState.jsx";

const SKELETON_ROWS = 4;

export default function TransactionList({
  transactions,
  loading,
  onEdit,
  onDelete,
  emptyMessage = "No hay movimientos este mes.",
}) {
  if (loading) {
    return (
      <SkeletonTheme baseColor="rgb(var(--surface-2))" highlightColor="rgb(var(--border))">
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton circle width={36} height={36} />
              <div className="min-w-0 flex-1">
                <Skeleton width="40%" height={14} />
                <Skeleton width="70%" height={12} style={{ marginTop: 6 }} />
              </div>
              <Skeleton width={64} height={16} />
            </li>
          ))}
        </ul>
      </SkeletonTheme>
    );
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
