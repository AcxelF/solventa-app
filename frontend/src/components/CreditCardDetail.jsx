import { useState } from "react";
import { Trash2, Pencil, Check, Undo2 } from "lucide-react";
import { formatMoney } from "../utils/format.js";
import { readableOn } from "../utils/color.js";
import { formatDateShort, formatTimeShort } from "../lib/dates.js";
import { markCreditCardPayment, unmarkCreditCardPayment } from "../api.js";
import Button from "./ui/Button.jsx";

function useCreditPercent(card) {
  const total = card.credit_limit;
  const available = card.cycle.available_credit;
  if (!total) return 0;
  return Math.round(((total - available) / total) * 100);
}

export default function CreditCardDetail({
  card,
  transactions,
  loading,
  onEdit,
  onDelete,
  onPaymentChange,
}) {
  const { cycle } = card;
  const textColor = readableOn(card.color);
  const usedPercent = useCreditPercent(card);
  const [togglingPayment, setTogglingPayment] = useState(false);

  async function handleTogglePayment() {
    setTogglingPayment(true);
    try {
      if (cycle.next_payment_paid) {
        await unmarkCreditCardPayment(card.id, cycle.next_payment);
      } else {
        await markCreditCardPayment(card.id, cycle.next_payment);
      }
      await onPaymentChange?.();
    } finally {
      setTogglingPayment(false);
    }
  }

  const timeline = [
    { key: "last_cut", label: "Corte anterior", date: cycle.last_cut, kind: "cut" },
    { key: "prev_payment", label: "Pago anterior", date: cycle.prev_payment, kind: "payment" },
    { key: "next_cut", label: "Corte actual", date: cycle.next_cut, kind: "cut" },
    { key: "next_payment", label: "Pago actual", date: cycle.next_payment, kind: "payment" },
  ].sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="space-y-5">
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          backgroundColor: card.color,
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.08))",
        }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: textColor }}>
            {card.name}
          </p>
          <p
            className="mt-0.5 font-mono text-xs tracking-[0.2em]"
            style={{ color: textColor }}
          >
            •••• {card.last_four}
          </p>
        </div>
        <span
          className="ml-auto text-xs font-semibold uppercase tracking-widest"
          style={{ color: textColor }}
        >
          {card.brand}
        </span>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-text">Ciclo de facturación</h4>
        <div className="relative mt-4">
          <div className="absolute left-0 right-0 top-2.5 h-px bg-border" />
          <div className="relative flex justify-between">
            {timeline.map((point) => (
              <div key={point.key} className="flex flex-col items-center gap-1.5">
                <span
                  className={`h-5 w-5 rounded-full border-2 border-surface ${
                    point.kind === "cut" ? "bg-indigo-500" : "bg-emerald-500"
                  }`}
                />
                <p className="text-xs font-medium text-text">{point.label}</p>
                <p className="text-xs text-text-muted">
                  {formatDateShort(point.date)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 ${
          cycle.next_payment_paid
            ? "border-border bg-surface-2"
            : "border-positive/30 bg-positive/10"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={`text-xs font-medium uppercase tracking-wider ${
                cycle.next_payment_paid ? "text-text-muted" : "text-positive"
              }`}
            >
              Monto a pagar
            </p>
            <p
              className={`mt-1 font-mono text-2xl font-semibold ${
                cycle.next_payment_paid ? "text-text-muted line-through" : "text-positive"
              }`}
            >
              {formatMoney(cycle.amount_due)}
            </p>
            <p
              className={`mt-1 text-xs ${
                cycle.next_payment_paid ? "text-text-muted" : "text-positive"
              }`}
            >
              {cycle.next_payment_paid
                ? `Pagado · vencía el ${formatDateShort(cycle.next_payment)}`
                : `Vence el ${formatDateShort(cycle.next_payment)} · ${
                    cycle.days_to_next_payment
                  } día${cycle.days_to_next_payment === 1 ? "" : "s"} restante${
                    cycle.days_to_next_payment === 1 ? "" : "s"
                  }`}
            </p>
          </div>
          <Button
            type="button"
            variant={cycle.next_payment_paid ? "subtle" : "primary"}
            onClick={handleTogglePayment}
            disabled={togglingPayment}
          >
            {cycle.next_payment_paid ? <Undo2 size={14} /> : <Check size={14} />}
            {cycle.next_payment_paid ? "Deshacer" : "Marcar pagado"}
          </Button>
        </div>
      </div>

      {card.interest_rate != null && (
        <p className="text-xs text-text-muted">
          Tasa de interés (TEA): <span className="font-mono font-medium text-text">{card.interest_rate}%</span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Consumo del periodo actual
          </p>
          <p className="mt-1 font-mono text-xl font-semibold text-text">
            {formatMoney(cycle.current_consumption)}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Desde {formatDateShort(cycle.last_cut)} hasta hoy
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Crédito disponible
          </p>
          <p className="mt-1 font-mono text-xl font-semibold text-text">
            {formatMoney(cycle.available_credit)}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${Math.min(usedPercent, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Línea total {formatMoney(card.credit_limit)}
          </p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-text">Cuotas y pagos</h4>
        {loading ? (
          <p className="mt-3 text-sm text-text-muted">Cargando…</p>
        ) : transactions.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            Aún no hay movimientos con esta tarjeta.
          </p>
        ) : (
          <ul className="mt-3 max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-bg">
            {transactions.map((transaction) => (
              <li
                key={transaction.id}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                    {formatDateShort(transaction.date)}
                    {formatTimeShort(transaction.created_at) && (
                      <span className="text-text-muted">
                        · {formatTimeShort(transaction.created_at)}
                      </span>
                    )}
                    {transaction.total_installments && (
                      <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                        Cuota {transaction.installment_number}/{transaction.total_installments}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-text">
                    {(transaction.description || transaction.category_name).replace(
                      /\s*\(cuota \d+\/\d+\)\s*$/i,
                      ""
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono text-sm font-semibold ${
                    transaction.type === "ingreso" ? "text-positive" : "text-text"
                  }`}
                >
                  {transaction.type === "ingreso" ? "+" : "−"}
                  {formatMoney(transaction.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button type="button" variant="danger" onClick={onDelete}>
          Eliminar tarjeta
        </Button>
        <Button type="button" variant="subtle" onClick={onEdit}>
          <Pencil size={14} />
          Editar tarjeta
        </Button>
      </div>
    </div>
  );
}
