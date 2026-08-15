import { CalendarClock, CircleCheck, Trash2 } from "lucide-react";
import { formatMoney } from "../utils/format.js";
import { formatDateShort, daysRemainingLabel } from "../lib/dates.js";
import ContributionForm from "./ContributionForm.jsx";
import Button from "./ui/Button.jsx";

function Progress({ goal }) {
  const completed = goal.completed;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        {completed ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
            <CircleCheck size={15} />
            Meta cumplida
          </span>
        ) : (
          <span className="text-xs text-text-muted">{goal.percent}% completado</span>
        )}
        <span className="shrink-0 font-mono text-sm font-semibold text-text">
          {formatMoney(goal.current_amount)} de {formatMoney(goal.target_amount)}
        </span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            completed ? "bg-amber-400" : "bg-indigo-500"
          }`}
          style={{ width: `${Math.min(goal.percent, 100)}%` }}
        />
      </div>

      {goal.deadline && (
        <p className="mt-2 flex items-center gap-1 text-xs text-text-muted">
          <CalendarClock size={13} className="shrink-0" />
          Para el {formatDateShort(goal.deadline)}
          {!completed && ` · ${daysRemainingLabel(goal.deadline)}`}
        </p>
      )}
    </div>
  );
}

export default function GoalDetail({
  goal,
  contributions,
  loading,
  onAddContribution,
  onDeleteContribution,
  onEdit,
  onDelete,
}) {
  return (
    <div className="space-y-5">
      <Progress goal={goal} />

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-semibold text-text">Agregar aporte</h4>
        <div className="mt-3">
          <ContributionForm onSubmit={onAddContribution} />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-semibold text-text">Aportes</h4>
        {loading ? (
          <p className="mt-3 text-sm text-text-muted">Cargando…</p>
        ) : contributions.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">Aún no hay aportes.</p>
        ) : (
          <ul className="mt-3 max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-bg">
            {contributions.map((contribution) => (
              <li
                key={contribution.id}
                className="group flex items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-secondary">
                    {formatDateShort(contribution.date)}
                  </p>
                  {contribution.note && (
                    <p className="truncate text-sm text-text">
                      {contribution.note}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-text">
                  {formatMoney(contribution.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteContribution(contribution)}
                  title="Eliminar aporte"
                  className="rounded-md p-1.5 text-text-muted opacity-0 transition-opacity duration-150 hover:bg-negative/10 hover:text-negative group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button type="button" variant="danger" onClick={onDelete}>
          Eliminar meta
        </Button>
        <Button type="button" variant="subtle" onClick={onEdit}>
          Editar meta
        </Button>
      </div>
    </div>
  );
}
