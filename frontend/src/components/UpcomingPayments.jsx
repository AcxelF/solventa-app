import { CreditCard, TriangleAlert } from "lucide-react";
import { formatMoney } from "../utils/format.js";
import { formatDateShort, daysRemainingLabel } from "../lib/dates.js";

export default function UpcomingPayments({ items, onNavigate }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h2 className="text-base font-semibold text-text">Próximos pagos</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">Sin pagos próximos</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) =>
            item.type === "card" ? (
              <li key={`card-${item.card_id}`}>
                <button
                  type="button"
                  onClick={() => onNavigate("credit-cards")}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2.5 text-left transition hover:border-indigo-500/40 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary">
                    <CreditCard size={15} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      Vence el {formatDateShort(item.date)} ·{" "}
                      {daysRemainingLabel(item.date)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold text-text">
                    {formatMoney(item.amount)}
                  </span>
                </button>
              </li>
            ) : (
              <li key={`budget-${item.budget_id}`}>
                <button
                  type="button"
                  onClick={() => onNavigate("budgets")}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2.5 text-left transition hover:border-amber-500/40 hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                    <TriangleAlert size={15} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">
                      {item.category}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      Falta {formatMoney(item.remaining)} para el límite
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold text-negative">
                    {item.percent}%
                  </span>
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
