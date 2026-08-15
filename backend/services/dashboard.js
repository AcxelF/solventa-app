const transactionsService = require("./transactions");
const budgetsService = require("./budgets");
const creditCardsService = require("./creditCards");
const goalsService = require("./goals");

const UPCOMING_LIMIT = 4;
const BUDGET_WARNING_PERCENT = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getTodayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
}

function currentMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

function shiftMonthBack(monthISO) {
  const [year, month] = monthISO.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

async function totalGastos(from, to) {
  const rows = await transactionsService.listTransactions({ from, to });
  return rows.reduce(
    (sum, t) => (t.type === "gasto" ? sum + t.amount : sum),
    0
  );
}

// Próximos pagos: el pago de cada tarjeta (monto a pagar + fecha del
// próximo pago) y los presupuestos del mes actual al 90% o más del límite.
// Se ordena por fecha más cercana primero; los presupuestos (sin fecha) van
// después, por porcentaje consumido descendente.
async function getUpcomingPayments() {
  const cards = (await creditCardsService.listCreditCards())
    .filter((card) => card.cycle && card.cycle.amount_due > 0)
    .map((card) => ({
      type: "card",
      card_id: card.id,
      label: card.name,
      amount: card.cycle.amount_due,
      date: card.cycle.next_payment,
      days_to_next_payment: card.cycle.days_to_next_payment,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const budgets = (await budgetsService.listBudgets({ month: currentMonthISO() }))
    .filter((b) => !b.overLimit && b.percent >= BUDGET_WARNING_PERCENT)
    .map((b) => ({
      type: "budget",
      budget_id: b.id,
      category: b.category,
      icon: b.icon,
      color: b.color,
      spent: b.spent,
      amount: b.amount,
      percent: b.percent,
      remaining: b.amount - b.spent,
    }))
    .sort((a, b) => b.percent - a.percent);

  return [...cards, ...budgets].slice(0, UPCOMING_LIMIT);
}

// Racha de presupuesto: para cada categoría con presupuesto, cuenta los meses
// consecutivos (desde el mes actual hacia atrás) donde el gasto real no
// superó el límite. Devuelve la racha más larga entre todas las categorías.
async function getBudgetStreak() {
  const allBudgets = await budgetsService.listBudgets();
  if (!allBudgets.length) return { months: 0 };

  const monthsWithBudgets = [...new Set(allBudgets.map((b) => b.month))];
  const spend = await budgetsService.spendByCategory(monthsWithBudgets);

  const byCategory = new Map();
  for (const budget of allBudgets) {
    if (!byCategory.has(budget.category_id)) {
      byCategory.set(budget.category_id, {
        category: budget.category,
        icon: budget.icon,
        color: budget.color,
        budgetsByMonth: new Map(),
      });
    }
    byCategory
      .get(budget.category_id)
      .budgetsByMonth.set(budget.month, budget);
  }

  let best = { months: 0, category: null, icon: null, color: null };
  for (const entry of byCategory.values()) {
    let streak = 0;
    let month = currentMonthISO();
    while (true) {
      const budget = entry.budgetsByMonth.get(month);
      if (!budget) break;
      const spent = spend.get(`${month}:${budget.category_id}`) || 0;
      if (spent > budget.amount) break;
      streak += 1;
      month = shiftMonthBack(month);
    }
    if (streak > best.months) {
      best = {
        months: streak,
        category: entry.category,
        icon: entry.icon,
        color: entry.color,
      };
    }
  }

  return best;
}

// Comparación justa con el mes pasado: mismo rango de días del mes actual
// (del día 1 a hoy) contra el mes anterior en el mismo rango de días.
async function getMonthComparison() {
  const today = getTodayISO();
  const [year, month, day] = today.split("-").map(Number);
  const currentFrom = `${year}-${pad2(month)}-01`;

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevToDay = Math.min(day, lastDayOfMonth(prevYear, prevMonth));
  const prevFrom = `${prevYear}-${pad2(prevMonth)}-01`;
  const prevTo = `${prevYear}-${pad2(prevMonth)}-${pad2(prevToDay)}`;

  const currentTotal = await totalGastos(currentFrom, today);
  const prevTotal = await totalGastos(prevFrom, prevTo);

  let pct = null;
  let direction = "same";
  if (prevTotal > 0) {
    pct = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
    if (currentTotal > prevTotal) direction = "up";
    else if (currentTotal < prevTotal) direction = "down";
  } else if (currentTotal > 0) {
    direction = "up";
  }

  return {
    current_total: currentTotal,
    prev_total: prevTotal,
    pct,
    direction,
    current_from: currentFrom,
    current_to: today,
    prev_from: prevFrom,
    prev_to: prevTo,
  };
}

// Meta más cercana: la meta activa con mayor porcentaje de avance.
async function getClosestGoal() {
  const active = (await goalsService.listGoals()).filter((goal) => !goal.completed);
  if (!active.length) return null;

  const best = active.reduce((a, b) => (b.percent > a.percent ? b : a));
  let daysLeft = null;
  if (best.deadline) {
    const today = getTodayISO();
    daysLeft = Math.round(
      (new Date(`${best.deadline}T00:00:00`) - new Date(`${today}T00:00:00`)) /
        DAY_MS
    );
  }

  return {
    goal_id: best.id,
    name: best.name,
    current_amount: best.current_amount,
    target_amount: best.target_amount,
    percent: best.percent,
    remaining: Math.max(0, best.target_amount - best.current_amount),
    deadline: best.deadline || null,
    days_left: daysLeft,
  };
}

// Categoría con más gasto del mes seleccionado.
async function getTopCategory(month) {
  const summary = await transactionsService.getSummary({ month });
  const top = summary.byCategory[0];
  if (!top || summary.totalGastos <= 0) return null;

  return {
    category_id: top.category_id,
    category: top.category,
    icon: top.icon,
    color: top.color,
    total: top.total,
    percent: Math.round((top.total / summary.totalGastos) * 100),
  };
}

async function getWidgets({ month } = {}) {
  const [upcoming_payments, budget_streak, month_comparison, closest_goal, top_category] =
    await Promise.all([
      getUpcomingPayments(),
      getBudgetStreak(),
      getMonthComparison(),
      getClosestGoal(),
      getTopCategory(month || currentMonthISO()),
    ]);

  return {
    upcoming_payments,
    budget_streak,
    month_comparison,
    closest_goal,
    top_category,
  };
}

module.exports = {
  getWidgets,
  getUpcomingPayments,
  getBudgetStreak,
  getMonthComparison,
  getClosestGoal,
  getTopCategory,
};
