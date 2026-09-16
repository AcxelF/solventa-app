import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  Tags,
  ChartPie,
  Target,
  CreditCard,
  FileText,
  Sun,
  Moon,
} from "lucide-react";
import Dashboard from "./components/Dashboard.jsx";
import AccountsView from "./components/AccountsView.jsx";
import CategoriesView from "./components/CategoriesView.jsx";
import BudgetsView from "./components/BudgetsView.jsx";
import GoalsView from "./components/GoalsView.jsx";
import CreditCardsView from "./components/CreditCardsView.jsx";
import TransactionsView from "./components/TransactionsView.jsx";
import ReportView from "./components/ReportView.jsx";
import { useTheme } from "./context/ThemeContext.jsx";
import { fetchAccounts, fetchCategories } from "./api.js";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "reports", label: "Informe PDF", icon: FileText },
  { key: "transactions", label: "Transacciones", icon: ArrowLeftRight },
  { key: "accounts", label: "Cuentas", icon: Landmark },
  { key: "credit-cards", label: "Tarjetas", icon: CreditCard },
  { key: "budgets", label: "Presupuestos", icon: ChartPie },
  { key: "goals", label: "Metas", icon: Target },
  { key: "categories", label: "Categorías", icon: Tags },
];

export default function App() {
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState("dashboard");
  const [navParams, setNavParams] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useCallback((nextView, params = {}) => {
    setNavParams(params);
    setView(nextView);
  }, []);

  const refreshMeta = useCallback(async () => {
    const [accs, cats] = await Promise.all([fetchAccounts(), fetchCategories()]);
    setAccounts(accs);
    setCategories(cats);
  }, []);

  useEffect(() => {
    refreshMeta()
      .then(() => setLoading(false))
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [refreshMeta]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex w-full max-w-[1920px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="order-1 flex items-center gap-3">
            <span className="flex h-8 w-9 items-center justify-center rounded-lg bg-text text-sm font-bold text-bg">
              S/
            </span>
            <h1 className="text-lg font-semibold text-text">Solventa</h1>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WhatsApp Bot</span>
            </div>
          </div>

          <nav className="no-scrollbar order-3 flex w-full min-w-0 items-center gap-1 overflow-x-auto rounded-full bg-surface p-1 lg:order-2 lg:ml-auto lg:w-auto">
            {NAV.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate(key)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                  view === key
                    ? "bg-bg font-medium text-text shadow-sm"
                    : "text-text-secondary hover:text-text"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>

          <div className="order-2 flex shrink-0 items-center gap-1 rounded-full bg-surface p-1 border border-border lg:order-3">
            {[
              { key: "light", label: "Modo claro", icon: Sun },
              { key: "dark", label: "Modo oscuro", icon: Moon },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTheme(key)}
                aria-label={label}
                title={label}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  theme === key
                    ? "bg-bg text-text shadow-sm border border-border"
                    : "text-text-secondary hover:text-text"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{key === "light" ? "Claro" : "Oscuro"}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1920px] px-6 pb-16 pt-8">
        {error && (
          <p className="rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
            No pude cargar los datos: {error}
          </p>
        )}

        {loading && <p className="text-sm text-text-muted">Cargando…</p>}

        {!loading && view === "dashboard" && (
          <Dashboard
            accounts={accounts}
            categories={categories}
            onDataChanged={refreshMeta}
            onNavigate={navigate}
          />
        )}
        {!loading && view === "reports" && <ReportView />}
        {!loading && view === "transactions" && (
          <TransactionsView
            accounts={accounts}
            categories={categories}
            onDataChanged={refreshMeta}
            initialFilters={navParams}
          />
        )}
        {!loading && view === "accounts" && (
          <AccountsView accounts={accounts} onDataChanged={refreshMeta} />
        )}
        {!loading && view === "categories" && (
          <CategoriesView categories={categories} onDataChanged={refreshMeta} />
        )}
        {!loading && view === "budgets" && (
          <BudgetsView categories={categories} />
        )}
        {!loading && view === "goals" && (
          <GoalsView initialGoalId={navParams.goalId} />
        )}
        {!loading && view === "credit-cards" && <CreditCardsView />}
      </main>
    </div>
  );
}
