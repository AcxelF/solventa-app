import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatMoney } from "../utils/format.js";

export default function ComparisonWidget({ comparison }) {
  if (!comparison) return null;

  const { current_total, prev_total, pct, direction } = comparison;

  let Icon = Minus;
  let tone = "text-text-secondary";
  let text = "Sin cambios frente al mes pasado";

  if (pct === null) {
    text =
      current_total > 0
        ? "No hay gastos del mes pasado para comparar"
        : "Sin gastos este mes ni el mes pasado";
  } else if (direction === "down") {
    Icon = ArrowDownRight;
    tone = "text-positive";
    text = `${Math.abs(pct)}% menos que el mes pasado`;
  } else if (direction === "up") {
    Icon = ArrowUpRight;
    tone = "text-negative";
    text = `${pct}% más que el mes pasado`;
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h2 className="text-base font-semibold text-text">
        Comparación con el mes pasado
      </h2>

      <p className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
        <Icon size={17} strokeWidth={2} />
        {text}
      </p>
      <p className="mt-1 text-xs text-text-muted">
        {formatMoney(current_total)} este mes vs {formatMoney(prev_total)} el
        pasado
      </p>
    </section>
  );
}
