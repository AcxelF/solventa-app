import { Target } from "lucide-react";
import { formatMoney } from "../utils/format.js";
import { formatDateShort, daysRemainingLabel } from "../lib/dates.js";

export default function ClosestGoal({ goal, onNavigate }) {
  if (!goal) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <h2 className="text-base font-semibold text-text">Meta más cercana</h2>
        <p className="mt-3 text-sm text-text-muted">
          No tienes metas de ahorro activas
        </p>
        <button
          type="button"
          onClick={() => onNavigate("goals")}
          className="mt-2 text-sm font-medium text-indigo-500 transition hover:text-indigo-600"
        >
          Crear una meta
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h2 className="text-base font-semibold text-text">Meta más cercana</h2>

      <button
        type="button"
        onClick={() => onNavigate("goals", { goalId: goal.goal_id })}
        className="mt-3 block w-full text-left"
      >
        <p className="flex items-center gap-2 text-sm font-medium text-text">
          <Target size={15} className="shrink-0 text-indigo-500" />
          <span className="truncate">{goal.name}</span>
        </p>

        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${Math.min(goal.percent, 100)}%` }}
          />
        </div>

        <p className="mt-2 font-mono text-sm font-semibold text-text">
          {formatMoney(goal.current_amount)}{" "}
          <span className="text-text-muted">de {formatMoney(goal.target_amount)}</span>
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {goal.percent}% completado · Falta {formatMoney(goal.remaining)}
        </p>
        {goal.deadline && (
          <p className="mt-1 text-xs text-text-muted">
            {formatDateShort(goal.deadline)} · {daysRemainingLabel(goal.deadline)}
          </p>
        )}
      </button>
    </section>
  );
}
