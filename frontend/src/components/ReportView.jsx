import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { fetchSummary, fetchTransactions, fetchDashboardWidgets } from "../api.js";
import { currentMonthISO, monthLabel, todayISO, formatDateShort } from "../lib/dates.js";
import { formatMoney } from "../utils/format.js";
import MonthNavigator from "./MonthNavigator.jsx";
import Button from "./ui/Button.jsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Misma fórmula que el widget de Salud Financiera del dashboard, para que
// el número del informe siempre coincida con el que ves ahí.
function computeHealthScore(summary) {
  const ingresos = summary.totalIngresos || 0;
  const gastos = summary.totalGastos || 0;
  const deuda = summary.creditDebt || 0;
  const ahorro = ingresos - gastos;
  const hasData = ingresos > 0 || gastos > 0 || deuda > 0;

  if (!hasData) {
    return { score: 0, label: "Sin movimientos", hasData: false };
  }

  let score = 50;
  if (ingresos > 0) {
    const tasaAhorro = ahorro / ingresos;
    if (tasaAhorro >= 0.3) score += 30;
    else if (tasaAhorro >= 0.15) score += 20;
    else if (tasaAhorro > 0) score += 10;
  }
  if (ingresos > 0) {
    const ratioDeuda = deuda / ingresos;
    if (ratioDeuda === 0) score += 20;
    else if (ratioDeuda <= 0.3) score += 15;
    else if (ratioDeuda <= 0.5) score += 5;
  } else if (deuda === 0) {
    score += 20;
  }
  score = Math.min(100, Math.max(10, score));

  let label = "Atención requerida";
  if (score >= 80) label = "Excelente";
  else if (score >= 60) label = "Saludable";

  return { score, label, hasData: true };
}

function SectionHeading({ number, children }) {
  return (
    <h3 className="border-b border-slate-300 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
      {number}. {children}
    </h3>
  );
}

function SummaryRow({ label, value, strong, negative }) {
  return (
    <div className="flex items-baseline justify-between border-b border-dotted border-slate-300 py-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <span
        className={`font-mono ${strong ? "text-base font-bold" : "font-semibold"} ${
          negative ? "text-red-700" : "text-slate-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, negative }) {
  return (
    <div className="flex items-start gap-2.5 border border-slate-200 p-3">
      <div className="rounded border border-slate-300 p-1.5 text-slate-700">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`mt-0.5 truncate font-mono text-sm font-bold ${negative ? "text-red-700" : "text-slate-900"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function ReportView() {
  const [month, setMonth] = useState(currentMonthISO());
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [widgets, setWidgets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef(null);

  const loadReport = useCallback(async (m) => {
    setLoading(true);
    try {
      const [summaryData, transactionsData, widgetsData] = await Promise.all([
        fetchSummary({ month: m }),
        fetchTransactions({ month: m }),
        fetchDashboardWidgets({ month: m }),
      ]);
      setSummary(summaryData);
      setTransactions(transactionsData);
      setWidgets(widgetsData);
    } catch (err) {
      console.error("[Report Load Error]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(month);
  }, [month, loadReport]);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Informe_Solventa_${month}.pdf`);
    } catch (err) {
      console.error("[PDF Download Error]", err);
    } finally {
      setDownloading(false);
    }
  };

  const ahorroNeto = summary ? summary.totalIngresos - summary.totalGastos : 0;
  const pctAhorro = summary && summary.totalIngresos > 0
    ? Math.max(0, Math.round((ahorroNeto / summary.totalIngresos) * 100))
    : 0;
  const topCategory = summary?.byCategory?.[0];
  const topCategoryPct = summary && summary.totalGastos > 0 && topCategory
    ? Math.round((topCategory.total / summary.totalGastos) * 100)
    : 0;
  const health = summary ? computeHealthScore(summary) : null;
  const comparison = widgets?.month_comparison;
  const sortedTransactions = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-text">
            <FileText className="text-emerald-500" size={24} />
            Informe Financiero Mensual
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Genera y descarga un reporte formal con saldos, categorías y análisis del mes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthNavigator month={month} onChange={setMonth} />
          <Button
            variant="primary"
            disabled={loading || downloading}
            onClick={handleDownloadPDF}
            className="shadow-md"
          >
            <Download size={16} />
            {downloading ? "Generando PDF..." : "Descargar Informe PDF"}
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-text-muted">Compilando reporte...</p>}

      {!loading && summary && (
        <div
          ref={reportRef}
          className="mx-auto max-w-3xl space-y-7 border border-slate-300 bg-white p-10 text-slate-900 shadow-2xl"
        >
          {/* Membrete */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-900 font-bold text-white">
                  S/
                </span>
                <span className="text-2xl font-bold tracking-tight text-slate-900">Solventa</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Plataforma de finanzas personales &amp; WhatsApp Bot
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                Informe financiero mensual
              </p>
              <p className="mt-1 text-lg font-bold capitalize text-slate-900">
                {monthLabel(month)}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Generado el {formatDateShort(todayISO())}
              </p>
            </div>
          </div>

          {/* KPIs al vistazo */}
          <div className="grid grid-cols-4 gap-3">
            <KpiTile icon={Wallet} label="Saldo líquido" value={formatMoney(summary.totalBalance)} />
            <KpiTile
              icon={CreditCard}
              label="Deuda tarjetas"
              value={formatMoney(summary.creditDebt || 0)}
              negative={(summary.creditDebt || 0) > 0}
            />
            <KpiTile icon={TrendingUp} label="Ingresos" value={formatMoney(summary.totalIngresos)} />
            <KpiTile icon={TrendingDown} label="Gastos" value={formatMoney(summary.totalGastos)} negative />
          </div>

          {/* 1. Resumen ejecutivo */}
          <div className="space-y-1">
            <SectionHeading number="1">Resumen Ejecutivo de Saldos</SectionHeading>
            <div>
              <SummaryRow label="Saldo líquido disponible" value={formatMoney(summary.totalBalance)} />
              <SummaryRow
                label="Deuda en tarjetas de crédito"
                value={formatMoney(summary.creditDebt || 0)}
                negative={(summary.creditDebt || 0) > 0}
              />
              <SummaryRow label="Ingresos totales del mes" value={formatMoney(summary.totalIngresos)} />
              <SummaryRow label="Gastos totales del mes" value={formatMoney(summary.totalGastos)} negative />
              <SummaryRow
                label={`Capacidad de ahorro del mes (${pctAhorro}% de los ingresos)`}
                value={formatMoney(ahorroNeto)}
                negative={ahorroNeto < 0}
                strong
              />
            </div>
          </div>

          {/* 2. Salud financiera */}
          {health && (
            <div className="space-y-2">
              <SectionHeading number="2">Salud Financiera</SectionHeading>
              <div className="flex items-center gap-4">
                <div className="rounded border border-slate-300 p-2 text-slate-700">
                  {health.score >= 80 ? (
                    <ShieldCheck size={18} />
                  ) : health.score >= 60 ? (
                    <TrendingUp size={18} />
                  ) : health.hasData ? (
                    <AlertTriangle size={18} />
                  ) : (
                    <Activity size={18} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-sm font-bold text-slate-900">{health.score}/100</span>
                    <span className="text-xs font-semibold text-slate-600">{health.label}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${health.score}%` }}
                    />
                  </div>
                </div>
              </div>
              {comparison && comparison.pct !== null && (
                <p className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
                  {comparison.direction === "up" ? (
                    <ArrowUpRight size={13} className="text-red-700" />
                  ) : comparison.direction === "down" ? (
                    <ArrowDownRight size={13} className="text-emerald-700" />
                  ) : null}
                  Gastaste un <strong className="text-slate-700">{Math.abs(comparison.pct)}%</strong>{" "}
                  {comparison.direction === "up" ? "más" : "menos"} que en el mismo período del mes anterior.
                </p>
              )}
            </div>
          )}

          {/* 3. Desglose por categoría */}
          <div className="space-y-2">
            <SectionHeading number="3">Desglose de Gastos por Categoría</SectionHeading>
            {summary.byCategory.length === 0 ? (
              <p className="text-xs text-slate-400">Sin gastos registrados en este período.</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="border-b border-slate-300 py-1.5 font-semibold">Categoría</th>
                    <th className="border-b border-slate-300 py-1.5 font-semibold">Participación</th>
                    <th className="border-b border-slate-300 py-1.5 text-right font-semibold">Monto</th>
                    <th className="border-b border-slate-300 py-1.5 pr-1 text-right font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCategory.slice(0, 8).map((cat, i) => {
                    const pct = summary.totalGastos > 0
                      ? Math.round((cat.total / summary.totalGastos) * 100)
                      : 0;
                    return (
                      <tr key={cat.category_id} className={i % 2 === 1 ? "bg-slate-50" : ""}>
                        <td className="border-b border-slate-200 py-1.5 pl-1 text-slate-700">{cat.category}</td>
                        <td className="border-b border-slate-200 py-1.5">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-slate-900"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </td>
                        <td className="border-b border-slate-200 py-1.5 text-right font-mono text-slate-900">
                          {formatMoney(cat.total)}
                        </td>
                        <td className="border-b border-slate-200 py-1.5 pr-1 text-right font-mono text-slate-500">
                          {pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 4. Métodos de pago */}
          <div className="space-y-2">
            <SectionHeading number="4">Análisis por Método de Pago</SectionHeading>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="border-b border-slate-200 py-2 text-slate-700">
                    Dinero líquido
                    <span className="ml-1 text-[10px] text-slate-400">(Efectivo, débito, Yape, Plin)</span>
                  </td>
                  <td className="border-b border-slate-200 py-2 text-right font-mono font-semibold text-slate-900">
                    {formatMoney(summary.gastosLiquidos || 0)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-700">
                    Tarjeta de crédito
                    <span className="ml-1 text-[10px] text-slate-400">(Líneas de crédito bancarias)</span>
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-slate-900">
                    {formatMoney(summary.gastosCredito || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. Observaciones */}
          <div className="space-y-2">
            <SectionHeading number="5">Observaciones</SectionHeading>
            <ul className="space-y-1.5 border-l-2 border-emerald-700 pl-3 text-xs text-slate-600">
              <li>
                Tu mayor categoría de gasto fue <strong className="text-slate-900">{topCategory?.category || "General"}</strong>,
                {" "}representando el <strong className="text-slate-900">{topCategoryPct}%</strong> de tus salidas del mes.
              </li>
              <li>
                Lograste conservar un <strong className="text-slate-900">{pctAhorro}%</strong> de tus ingresos mensuales
                {ahorroNeto < 0 ? " (mes con saldo negativo)" : ""}.
              </li>
            </ul>
          </div>

          {/* 6. Detalle de movimientos */}
          <div className="space-y-2">
            <SectionHeading number="6">Detalle de Movimientos ({sortedTransactions.length})</SectionHeading>
            {sortedTransactions.length === 0 ? (
              <p className="text-xs text-slate-400">Sin movimientos registrados en este período.</p>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wider text-slate-500">
                    <th className="border-b border-slate-300 py-1.5 font-semibold">Fecha</th>
                    <th className="border-b border-slate-300 py-1.5 font-semibold">Categoría</th>
                    <th className="border-b border-slate-300 py-1.5 font-semibold">Cuenta</th>
                    <th className="border-b border-slate-300 py-1.5 font-semibold">Detalle</th>
                    <th className="border-b border-slate-300 py-1.5 pr-1 text-right font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((t, i) => (
                    <tr key={t.id} className={i % 2 === 1 ? "bg-slate-50" : ""}>
                      <td className="border-b border-slate-200 py-1.5 pl-1 text-slate-500">
                        {formatDateShort(t.date)}
                      </td>
                      <td className="border-b border-slate-200 py-1.5 text-slate-700">{t.category_name}</td>
                      <td className="border-b border-slate-200 py-1.5 text-slate-500">{t.account_name}</td>
                      <td className="max-w-[160px] truncate border-b border-slate-200 py-1.5 text-slate-500">
                        {t.description || "—"}
                      </td>
                      <td
                        className={`border-b border-slate-200 py-1.5 pr-1 text-right font-mono font-semibold ${
                          t.type === "ingreso" ? "text-emerald-700" : "text-slate-900"
                        }`}
                      >
                        {t.type === "ingreso" ? "+" : "−"}
                        {formatMoney(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pie del documento */}
          <div className="flex items-center justify-between border-t border-slate-300 pt-4 text-[9px] text-slate-400">
            <span>Documento generado automáticamente por Solventa App &amp; WhatsApp Bot</span>
            <span>solventa-app.vercel.app</span>
          </div>
        </div>
      )}
    </div>
  );
}
