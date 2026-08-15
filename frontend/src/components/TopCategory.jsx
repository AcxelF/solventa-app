import { categoryIcon } from "../lib/categoryIcons.js";
import { formatMoney } from "../utils/format.js";
import IconBadge from "./ui/IconBadge.jsx";

function pad(value) {
  return String(value).padStart(2, "0");
}

function monthRange(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const last = new Date(year, monthIndex, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${pad(last)}`,
  };
}

export default function TopCategory({ category, month, onNavigate }) {
  if (!category) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <h2 className="text-base font-semibold text-text">
          Categoría con más gasto
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          Sin gastos registrados este mes
        </p>
      </section>
    );
  }

  const Icon = categoryIcon(category.icon);
  const { from, to } = monthRange(month);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h2 className="text-base font-semibold text-text">
        Categoría con más gasto
      </h2>

      <button
        type="button"
        onClick={() =>
          onNavigate("transactions", {
            category_id: category.category_id,
            from,
            to,
          })
        }
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2.5 text-left transition hover:border-indigo-500/40 hover:shadow-sm"
      >
        <IconBadge color={category.color} icon={Icon} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">
            {category.category}
          </span>
          <span className="block truncate text-xs text-text-muted">
            {category.percent}% de tus gastos este mes
          </span>
        </span>
        <span className="shrink-0 font-mono text-sm font-semibold text-text">
          {formatMoney(category.total)}
        </span>
      </button>
    </section>
  );
}
