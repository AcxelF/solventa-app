import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, CheckCircle2, Sparkles, PieChart, Wallet, CreditCard as CardIcon } from "lucide-react";
import { fetchSummary, fetchTransactions, fetchDashboardWidgets } from "../api.js";
import { currentMonthISO, monthLabel } from "../lib/dates.js";
import { formatMoney } from "../utils/format.js";
import MonthNavigator from "./MonthNavigator.jsx";
import Button from "./ui/Button.jsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
        backgroundColor: "#0f172a", // Mantener contraste o color de fondo
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div>
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            <FileText className="text-emerald-500" size={24} />
            Informe Financiero Mensual
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Genera y descarga un reporte ejecutivo detallado con saldos, categorías e inteligencia financiera.
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
          className="rounded-2xl border border-border bg-slate-900 p-8 text-slate-100 shadow-2xl space-y-8 max-w-4xl mx-auto"
        >
          {/* Header del Reporte */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-6 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-bold text-slate-950">
                  S/
                </span>
                <span className="text-2xl font-bold tracking-tight text-white">Solventa</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Plataforma de Finanzas Personales & WhatsApp Bot</p>
            </div>
            <div className="text-right">
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
                REPORTE OFICIAL
              </span>
              <p className="mt-2 text-sm font-medium text-slate-300 capitalize">
                {monthLabel(month)}
              </p>
            </div>
          </div>

          {/* 1. Resumen Ejecutivo */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Wallet size={16} className="text-emerald-400" />
              1. Resumen Ejecutivo de Saldos
            </h3>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4">
                <p className="text-[11px] font-medium uppercase text-slate-400">Saldo Líquido</p>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-400">
                  {formatMoney(summary.totalBalance)}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-[11px] font-medium uppercase text-amber-400">Deuda Tarjetas</p>
                <p className="mt-1 font-mono text-xl font-bold text-amber-400">
                  {formatMoney(summary.creditDebt || 0)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4">
                <p className="text-[11px] font-medium uppercase text-slate-400">Ingresos Totales</p>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-400">
                  {formatMoney(summary.totalIngresos)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4">
                <p className="text-[11px] font-medium uppercase text-slate-400">Gastos Totales</p>
                <p className="mt-1 font-mono text-xl font-bold text-rose-400">
                  {formatMoney(summary.totalGastos)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-800/30 px-4 py-3 border border-slate-800">
              <span className="text-xs text-slate-300">Capacidad de Ahorro del Mes:</span>
              <span className="font-mono text-sm font-bold text-emerald-400">
                {formatMoney(ahorroNeto)} ({pctAhorro}% de los ingresos)
              </span>
            </div>
          </div>

          {/* 2. Desglose de Gastos por Categoría */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <PieChart size={16} className="text-emerald-400" />
              2. Desglose de Gastos por Categoría
            </h3>
            {summary.byCategory.length === 0 ? (
              <p className="text-xs text-slate-500">Sin gastos registrados en este período.</p>
            ) : (
              <div className="space-y-2">
                {summary.byCategory.slice(0, 6).map((cat) => {
                  const pct = summary.totalGastos > 0 
                    ? Math.round((cat.total / summary.totalGastos) * 100) 
                    : 0;
                  return (
                    <div key={cat.category_id} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-300">{cat.category}</span>
                        <span className="font-mono text-slate-200">
                          {formatMoney(cat.total)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Métodos de Pago */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <CardIcon size={16} className="text-emerald-400" />
              3. Análisis por Método de Pago
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
                <p className="text-xs font-medium text-slate-300">Pagado con Dinero Líquido</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-100">
                  {formatMoney(summary.gastosLiquidos || 0)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">Efectivo, Débito, Yape, Plin</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
                <p className="text-xs font-medium text-slate-300">Cargado a Tarjeta de Crédito</p>
                <p className="mt-1 font-mono text-lg font-bold text-amber-400">
                  {formatMoney(summary.gastosCredito || 0)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">Líneas de crédito bancarias</p>
              </div>
            </div>
          </div>

          {/* 4. Insights Inteligencia Financiera */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles size={14} />
              Insights de Inteligencia Financiera
            </h4>
            <ul className="text-xs text-slate-300 space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                <span>
                  Tu mayor categoría de gasto fue <strong>{summary.byCategory[0]?.category || "General"}</strong> representando el {summary.totalGastos > 0 ? Math.round(((summary.byCategory[0]?.total || 0) / summary.totalGastos) * 100) : 0}% de tus salidas.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                <span>
                  Lograste conservar un <strong>{pctAhorro}%</strong> de tus ingresos mensuales.
                </span>
              </li>
            </ul>
          </div>

          {/* Footer del Reporte */}
          <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-[10px] text-slate-500">
            <span>Generado automáticamente por Solventa App & WhatsApp Bot</span>
            <span>https://solventa-app.vercel.app</span>
          </div>
        </div>
      )}
    </div>
  );
}
