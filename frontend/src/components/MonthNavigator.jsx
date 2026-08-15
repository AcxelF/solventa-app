import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonthISO, monthLabel, shiftMonth } from "../lib/dates.js";

export default function MonthNavigator({ month, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Mes anterior"
        className="rounded-lg border border-border p-2 text-text-secondary hover:border-text-muted hover:text-text"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="w-40 text-center text-sm font-semibold text-text">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Mes siguiente"
        className="rounded-lg border border-border p-2 text-text-secondary hover:border-text-muted hover:text-text"
      >
        <ChevronRight size={16} />
      </button>
      <button
        type="button"
        onClick={() => onChange(currentMonthISO())}
        className="ml-2 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:border-text-muted hover:text-text"
      >
        Hoy
      </button>
    </div>
  );
}
