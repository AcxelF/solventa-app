import { ShieldCheck, TrendingUp, AlertTriangle, Activity } from "lucide-react";

export default function FinancialHealthScore({ summary }) {
  if (!summary) return null;

  const ingresos = summary.totalIngresos || 0;
  const gastos = summary.totalGastos || 0;
  const deuda = summary.creditDebt || 0;
  const ahorro = ingresos - gastos;
  const hasData = ingresos > 0 || gastos > 0 || deuda > 0;

  let score = 0;
  let statusLabel = "Sin movimientos";
  let statusColor = "text-text-muted bg-surface-2 border-border";
  let Icon = Activity;

  if (hasData) {
    score = 50; // base

    // + 30 puntos por tasa de ahorro
    if (ingresos > 0) {
      const tasaAhorro = ahorro / ingresos;
      if (tasaAhorro >= 0.3) score += 30;
      else if (tasaAhorro >= 0.15) score += 20;
      else if (tasaAhorro > 0) score += 10;
    }

    // + 20 puntos por bajo nivel de deuda en tarjetas respecto a ingresos
    if (ingresos > 0) {
      const ratioDeuda = deuda / ingresos;
      if (ratioDeuda === 0) score += 20;
      else if (ratioDeuda <= 0.3) score += 15;
      else if (ratioDeuda <= 0.5) score += 5;
    } else if (deuda === 0) {
      score += 20;
    }

    score = Math.min(100, Math.max(10, score));

    if (score >= 80) {
      statusLabel = "Excelente";
      statusColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      Icon = ShieldCheck;
    } else if (score >= 60) {
      statusLabel = "Saludable";
      statusColor = "text-teal-500 bg-teal-500/10 border-teal-500/20";
      Icon = TrendingUp;
    } else {
      statusLabel = "Atención Requerida";
      statusColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
      Icon = AlertTriangle;
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-soft transition hover:border-emerald-500/30 hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2.5 border ${statusColor}`}>
            <Icon size={22} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Salud Financiera
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-2xl font-bold text-text">
                {score}/100
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="hidden sm:block text-right text-xs text-text-muted">
          <p>Ahorro neto: <strong className="text-emerald-500 font-mono">S/ {ahorro.toFixed(2)}</strong></p>
          <p className="mt-0.5">Deuda tarjetas: <strong className="text-amber-500 font-mono">S/ {deuda.toFixed(2)}</strong></p>
        </div>
      </div>

      <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${hasData ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-surface-2'}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
