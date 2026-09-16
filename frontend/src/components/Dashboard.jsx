import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Plus, Landmark, CreditCard } from "lucide-react";
import {
  fetchSummary,
  fetchTransactions,
  fetchDashboardWidgets,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../api.js";
import { currentMonthISO } from "../lib/dates.js";
import AnimatedMoney from "./ui/AnimatedMoney.jsx";
import MonthNavigator from "./MonthNavigator.jsx";
import SummaryCards from "./SummaryCards.jsx";
import CategoryDonut from "./CategoryDonut.jsx";
import TransactionList from "./TransactionList.jsx";
import TransactionForm from "./TransactionForm.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import UpcomingPayments from "./UpcomingPayments.jsx";
import StreakWidget from "./StreakWidget.jsx";
import ComparisonWidget from "./ComparisonWidget.jsx";
import ClosestGoal from "./ClosestGoal.jsx";
import TopCategory from "./TopCategory.jsx";
import FinancialHealthScore from "./FinancialHealthScore.jsx";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";

const PREVIEW_LIMIT = 5;

function emptySummary() {
  return {
    totalBalance: 0,
    totalIngresos: 0,
    totalGastos: 0,
    balance: 0,
    byCategory: [],
  };
}

function emptyWidgets() {
  return {
    upcoming_payments: [],
    budget_streak: { months: 0, category: null, icon: null, color: null },
    month_comparison: null,
    closest_goal: null,
    top_category: null,
  };
}

export default function Dashboard({
  accounts,
  categories,
  onDataChanged,
  onNavigate,
}) {
  const [month, setMonth] = useState(currentMonthISO());
  const [summary, setSummary] = useState(emptySummary());
  const [transactions, setTransactions] = useState([]);
  const [widgets, setWidgets] = useState(emptyWidgets());
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async (m) => {
    const [summaryData, transactionsData, widgetsData] = await Promise.all([
      fetchSummary({ month: m }),
      fetchTransactions({ month: m }),
      fetchDashboardWidgets({ month: m }),
    ]);
    setSummary(summaryData);
    setTransactions(transactionsData);
    setWidgets(widgetsData);
  }, []);

  useEffect(() => {
    setLoading(true);
    load(month)
      .then(() => setLoading(false))
      .catch(() => setLoading(false));

    const interval = setInterval(() => {
      load(month).catch(() => {});
      if (onDataChanged) onDataChanged();
    }, 4000);

    return () => clearInterval(interval);
  }, [month, load, onDataChanged]);

  async function handleSave(payload) {
    if (form?.editing) {
      await updateTransaction(form.editing.id, payload);
    } else {
      await createTransaction(payload);
    }
    setForm(null);
    await load(month);
    await onDataChanged();
  }

  async function confirmDelete() {
    if (pendingDelete == null) return;
    const id = pendingDelete;
    setPendingDelete(null);
    await deleteTransaction(id);
    await load(month);
    await onDataChanged();
  }

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[22fr_56fr_22fr]">
        <aside className="min-w-0 space-y-6">
          <UpcomingPayments
            items={widgets.upcoming_payments}
            onNavigate={onNavigate}
          />
          <TopCategory
            category={widgets.top_category}
            month={month}
            onNavigate={onNavigate}
          />
        </aside>

        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Cuadro 1: Saldo Líquido Disponible */}
            <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-soft transition hover:border-border-hover">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Saldo Líquido Disponible
                  </p>
                  <p className="mt-1 font-mono text-3xl sm:text-4xl font-semibold text-text">
                    <AnimatedMoney value={summary.totalBalance} />
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Landmark size={24} />
                </div>
              </div>
              <p className="mt-4 text-xs text-text-muted">
                Dinero disponible real en efectivo y cuentas de débito
              </p>
            </div>

            {/* Cuadro 2: Deuda en Tarjetas de Crédito */}
            <div className="flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 shadow-soft transition hover:border-amber-500/50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Deuda en Tarjetas
                  </p>
                  <p className="mt-1 font-mono text-3xl sm:text-4xl font-semibold text-amber-600 dark:text-amber-400">
                    <AnimatedMoney value={summary.creditDebt} />
                  </p>
                </div>
                <div className="rounded-xl bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <CreditCard size={24} />
                </div>
              </div>
              <p className="mt-4 text-xs text-amber-600/80 dark:text-amber-400/80">
                Línea de crédito acumulada utilizada a pagar
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-soft">
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Período Seleccionado</span>
            <MonthNavigator month={month} onChange={setMonth} />
          </div>

          <FinancialHealthScore summary={summary} />

          <SummaryCards summary={summary} />

          <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
            <CategoryDonut data={summary.byCategory} />

            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-text">
                  Movimientos
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => onNavigate("transactions")}
                  >
                    Ver todos
                    <ArrowRight size={15} />
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setForm({ editing: null })}
                  >
                    <Plus size={16} />
                    Nuevo
                  </Button>
                </div>
              </div>
              <div className="mt-3">
                <TransactionList
                  transactions={transactions.slice(0, PREVIEW_LIMIT)}
                  loading={loading}
                  onEdit={(transaction) => setForm({ editing: transaction })}
                  onDelete={setPendingDelete}
                />
              </div>
            </section>
          </div>
        </div>

        <aside className="min-w-0 space-y-6">
          <StreakWidget streak={widgets.budget_streak} />
          <ClosestGoal goal={widgets.closest_goal} onNavigate={onNavigate} />
          <ComparisonWidget comparison={widgets.month_comparison} />
        </aside>
      </div>

      {form && (
        <Modal
          title={form.editing ? "Editar movimiento" : "Nuevo movimiento"}
          onClose={() => setForm(null)}
        >
          <TransactionForm
            accounts={accounts}
            categories={categories}
            initial={form.editing}
            onSubmit={handleSave}
            onCancel={() => setForm(null)}
          />
        </Modal>
      )}

      {pendingDelete != null && (
        <ConfirmDialog
          title="¿Eliminar movimiento?"
          message="Esta acción no se puede deshacer."
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
