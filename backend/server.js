require("dotenv").config();
const express = require("express");
const cors = require("cors");
const accountsService = require("./services/accounts");
const categoriesService = require("./services/categories");
const transactionsService = require("./services/transactions");
const budgetsService = require("./services/budgets");
const goalsService = require("./services/goals");
const creditCardsService = require("./services/creditCards");
const dashboardService = require("./services/dashboard");
const { ValidationError } = require("./services/errors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function handle(fn) {
  return (req, res) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
      }
      if (err && typeof err.code === "string" && err.code.startsWith("SQLITE_CONSTRAINT")) {
        return res.status(400).json({ error: "No se pudo guardar: ese registro ya existe o está en uso." });
      }
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  };
}

// ---- Cuentas ----
app.get("/api/accounts", handle((req, res) => {
  res.json(accountsService.listAccounts());
}));

app.post("/api/accounts", handle((req, res) => {
  res.status(201).json(accountsService.createAccount(req.body));
}));

app.put("/api/accounts/:id", handle((req, res) => {
  const account = accountsService.updateAccount(Number(req.params.id), req.body);
  if (!account) return res.status(404).json({ error: "Cuenta no encontrada." });
  res.json(account);
}));

app.delete("/api/accounts/:id", handle((req, res) => {
  const deleted = accountsService.deleteAccount(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Cuenta no encontrada." });
  res.status(204).send();
}));

// ---- Categorías ----
app.get("/api/categories", handle((req, res) => {
  res.json(categoriesService.listCategories({ type: req.query.type }));
}));

app.post("/api/categories", handle((req, res) => {
  res.status(201).json(categoriesService.createCategory(req.body));
}));

app.put("/api/categories/:id", handle((req, res) => {
  const category = categoriesService.updateCategory(Number(req.params.id), req.body);
  if (!category) return res.status(404).json({ error: "Categoría no encontrada." });
  res.json(category);
}));

app.delete("/api/categories/:id", handle((req, res) => {
  const deleted = categoriesService.deleteCategory(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Categoría no encontrada." });
  res.status(204).send();
}));

// ---- Transacciones ----
app.get("/api/transactions", handle((req, res) => {
  res.json(transactionsService.listTransactions(req.query));
}));

app.post("/api/transactions", handle((req, res) => {
  res.status(201).json(transactionsService.createTransaction(req.body));
}));

app.put("/api/transactions/:id", handle((req, res) => {
  const transaction = transactionsService.updateTransaction(Number(req.params.id), req.body);
  if (!transaction) return res.status(404).json({ error: "Transacción no encontrada." });
  res.json(transaction);
}));

app.delete("/api/transactions/:id", handle((req, res) => {
  const deleted = transactionsService.deleteTransaction(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Transacción no encontrada." });
  res.status(204).send();
}));

// ---- Presupuestos ----
app.get("/api/budgets", handle((req, res) => {
  res.json(budgetsService.listBudgets({ month: req.query.month }));
}));

app.post("/api/budgets", handle((req, res) => {
  res.status(201).json(budgetsService.createBudget(req.body));
}));

app.put("/api/budgets/:id", handle((req, res) => {
  const budget = budgetsService.updateBudget(Number(req.params.id), req.body);
  if (!budget) return res.status(404).json({ error: "Presupuesto no encontrado." });
  res.json(budget);
}));

app.delete("/api/budgets/:id", handle((req, res) => {
  const deleted = budgetsService.deleteBudget(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Presupuesto no encontrado." });
  res.status(204).send();
}));

// ---- Metas de ahorro ----
app.get("/api/goals", handle((req, res) => {
  res.json(goalsService.listGoals());
}));

app.post("/api/goals", handle((req, res) => {
  res.status(201).json(goalsService.createGoal(req.body));
}));

app.get("/api/goals/:id", handle((req, res) => {
  const goal = goalsService.getGoal(Number(req.params.id));
  if (!goal) return res.status(404).json({ error: "Meta no encontrada." });
  res.json(goal);
}));

app.put("/api/goals/:id", handle((req, res) => {
  const goal = goalsService.updateGoal(Number(req.params.id), req.body);
  if (!goal) return res.status(404).json({ error: "Meta no encontrada." });
  res.json(goal);
}));

app.delete("/api/goals/:id", handle((req, res) => {
  const deleted = goalsService.deleteGoal(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Meta no encontrada." });
  res.status(204).send();
}));

app.get("/api/goals/:id/contributions", handle((req, res) => {
  res.json(goalsService.listContributions(Number(req.params.id)));
}));

app.post("/api/goals/:id/contributions", handle((req, res) => {
  res.status(201).json(
    goalsService.addContribution(Number(req.params.id), req.body)
  );
}));

app.delete("/api/contributions/:id", handle((req, res) => {
  const deleted = goalsService.deleteContribution(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Aporte no encontrado." });
  res.status(204).send();
}));

// ---- Tarjetas de crédito ----
app.get("/api/credit-cards", handle((req, res) => {
  res.json(creditCardsService.listCreditCards());
}));

app.post("/api/credit-cards", handle((req, res) => {
  res.status(201).json(creditCardsService.createCreditCard(req.body));
}));

app.get("/api/credit-cards/:id", handle((req, res) => {
  const card = creditCardsService.getCreditCard(Number(req.params.id));
  if (!card) return res.status(404).json({ error: "Tarjeta no encontrada." });
  res.json(card);
}));

app.put("/api/credit-cards/:id", handle((req, res) => {
  const card = creditCardsService.updateCreditCard(Number(req.params.id), req.body);
  if (!card) return res.status(404).json({ error: "Tarjeta no encontrada." });
  res.json(card);
}));

app.delete("/api/credit-cards/:id", handle((req, res) => {
  const deleted = creditCardsService.deleteCreditCard(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Tarjeta no encontrada." });
  res.status(204).send();
}));

// ---- Resumen ----
app.get("/api/summary", handle((req, res) => {
  res.json(
    transactionsService.getSummary({
      month: req.query.month,
      account_id: req.query.account_id,
    })
  );
}));

// ---- Widgets del dashboard ----
app.get("/api/dashboard/widgets", handle((req, res) => {
  res.json(dashboardService.getWidgets({ month: req.query.month }));
}));

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});
