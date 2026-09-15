import { formatMoney } from "../utils/format.js";

export default function SummaryCards({ summary }) {
  const cards = [
    {
      label: "Ingresos del mes",
      value: summary.totalIngresos,
      valueClass: "text-positive",
      subtext: "Entradas en efectivo y cuentas",
    },
    {
      label: "Gastos del mes",
      value: summary.totalGastos,
      valueClass: "text-negative",
      subtext: summary.gastosCredito > 0 
        ? `Líquido: ${formatMoney(summary.gastosLiquidos || 0)} | Crédito: ${formatMoney(summary.gastosCredito || 0)}`
        : "Total de salidas registradas",
    },
    {
      label: "Balance del mes",
      value: summary.balance,
      valueClass: summary.balance >= 0 ? "text-positive" : "text-negative",
      subtext: "Diferencia entre ingresos y gastos",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-border bg-surface p-5 shadow-soft transition hover:border-border-hover"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {card.label}
          </p>
          <p className={`mt-1 font-mono text-2xl font-semibold ${card.valueClass}`}>
            {formatMoney(card.value)}
          </p>
          <p className="mt-1.5 text-xs text-text-secondary truncate" title={card.subtext}>
            {card.subtext}
          </p>
        </div>
      ))}
    </div>
  );
}
