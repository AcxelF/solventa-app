import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { categoryIcon } from "../lib/categoryIcons.js";
import { formatMoney } from "../utils/format.js";
import IconBadge from "./ui/IconBadge.jsx";
import EmptyState from "./ui/EmptyState.jsx";

export default function CategoryDonut({ data }) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-text">
          Gastos por categoría
        </h2>
        <div className="mt-4">
          <EmptyState message="Sin gastos este mes." />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-base font-semibold text-text">
        Gastos por categoría
      </h2>

      <div className="mt-2 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.category_id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatMoney(value)}
              contentStyle={{
                fontFamily: "Inter, sans-serif",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                fontSize: "13px",
                color: "var(--text)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-2 space-y-2">
        {data.map((entry) => {
          const Icon = categoryIcon(entry.icon);
          return (
            <li key={entry.category_id} className="flex items-center gap-3 text-sm">
              <IconBadge color={entry.color} icon={Icon} size={26} />
              <span className="flex-1 text-text-secondary">{entry.category}</span>
              <span className="font-mono text-text">
                {formatMoney(entry.total)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
