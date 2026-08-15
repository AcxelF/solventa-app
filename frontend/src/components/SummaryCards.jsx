import { formatMoney } from "../utils/format.js";

export default function SummaryCards({ summary }) {
  const cards = [
    {
      label: "Ingresos del mes",
      value: summary.totalIngresos,
      valueClass: "text-positive",
    },
    {
      label: "Gastos del mes",
      value: summary.totalGastos,
      valueClass: "text-negative",
    },
    {
      label: "Balance del mes",
      value: summary.balance,
      valueClass: "text-text",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-border bg-surface p-5 shadow-soft"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {card.label}
          </p>
          <p className={`mt-1 font-mono text-2xl font-semibold ${card.valueClass}`}>
            {formatMoney(card.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
