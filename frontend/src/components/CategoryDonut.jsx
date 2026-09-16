import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { categoryIcon } from "../lib/categoryIcons.js";
import { formatMoney } from "../utils/format.js";
import IconBadge from "./ui/IconBadge.jsx";
import EmptyState from "./ui/EmptyState.jsx";

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-xl text-xs font-medium">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: data.payload?.color || data.fill }}
          />
          <span className="text-text-muted">{data.name}:</span>
          <span className="font-mono font-bold text-text">
            {formatMoney(data.value)}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

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
            <Tooltip content={<CustomTooltip />} />
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
