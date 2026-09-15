require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const accountsService = require("./services/accounts");
const categoriesService = require("./services/categories");
const transactionsService = require("./services/transactions");
const budgetsService = require("./services/budgets");
const goalsService = require("./services/goals");
const creditCardsService = require("./services/creditCards");
const dashboardService = require("./services/dashboard");
const whatsappService = require("./services/whatsappService");
const whatsappParser = require("./services/whatsappParser");
const { ValidationError } = require("./services/errors");

const app = express();
const PORT = process.env.PORT || 3001;

// ---- CORS ----
// Mientras no tengas tu dominio de Vercel asignado, CORS permite cualquier
// origen (esto incluye cualquier dominio *.vercel.app), así que el frontend
// desplegado en Vercel podrá llamar a la API sin configuración extra.
//
// Cuando Vercel te asigne tu dominio exacto, reemplaza el bloque de abajo por:
//
//   const allowedOrigins = [
//     "http://localhost:5173",                    // desarrollo local
//     "https://tu-app.vercel.app",                // ← PEGA TU DOMINIO DE VERCEL AQUÍ
//   ];
//   app.use(cors({ origin: allowedOrigins }));
//
// (Sin esa restricción, la API acepta peticiones de cualquier dominio.)
app.use(cors());
app.use(express.json());

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
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
app.get("/api/accounts", handle(async (req, res) => {
  res.json(await accountsService.listAccounts());
}));

app.post("/api/accounts", handle(async (req, res) => {
  res.status(201).json(await accountsService.createAccount(req.body));
}));

app.put("/api/accounts/:id", handle(async (req, res) => {
  const account = await accountsService.updateAccount(Number(req.params.id), req.body);
  if (!account) return res.status(404).json({ error: "Cuenta no encontrada." });
  res.json(account);
}));

app.delete("/api/accounts/:id", handle(async (req, res) => {
  const deleted = await accountsService.deleteAccount(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Cuenta no encontrada." });
  res.status(204).send();
}));

// ---- Categorías ----
app.get("/api/categories", handle(async (req, res) => {
  res.json(await categoriesService.listCategories({ type: req.query.type }));
}));

app.post("/api/categories", handle(async (req, res) => {
  res.status(201).json(await categoriesService.createCategory(req.body));
}));

app.put("/api/categories/:id", handle(async (req, res) => {
  const category = await categoriesService.updateCategory(Number(req.params.id), req.body);
  if (!category) return res.status(404).json({ error: "Categoría no encontrada." });
  res.json(category);
}));

app.delete("/api/categories/:id", handle(async (req, res) => {
  const deleted = await categoriesService.deleteCategory(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Categoría no encontrada." });
  res.status(204).send();
}));

// ---- Transacciones ----
app.get("/api/transactions", handle(async (req, res) => {
  res.json(await transactionsService.listTransactions(req.query));
}));

app.post("/api/transactions", handle(async (req, res) => {
  res.status(201).json(await transactionsService.createTransaction(req.body));
}));

app.put("/api/transactions/:id", handle(async (req, res) => {
  const transaction = await transactionsService.updateTransaction(Number(req.params.id), req.body);
  if (!transaction) return res.status(404).json({ error: "Transacción no encontrada." });
  res.json(transaction);
}));

app.delete("/api/transactions/:id", handle(async (req, res) => {
  const deleted = await transactionsService.deleteTransaction(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Transacción no encontrada." });
  res.status(204).send();
}));

// ---- Presupuestos ----
app.get("/api/budgets", handle(async (req, res) => {
  res.json(await budgetsService.listBudgets({ month: req.query.month }));
}));

app.post("/api/budgets", handle(async (req, res) => {
  res.status(201).json(await budgetsService.createBudget(req.body));
}));

app.put("/api/budgets/:id", handle(async (req, res) => {
  const budget = await budgetsService.updateBudget(Number(req.params.id), req.body);
  if (!budget) return res.status(404).json({ error: "Presupuesto no encontrado." });
  res.json(budget);
}));

app.delete("/api/budgets/:id", handle(async (req, res) => {
  const deleted = await budgetsService.deleteBudget(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Presupuesto no encontrado." });
  res.status(204).send();
}));

// ---- Metas de ahorro ----
app.get("/api/goals", handle(async (req, res) => {
  res.json(await goalsService.listGoals());
}));

app.post("/api/goals", handle(async (req, res) => {
  res.status(201).json(await goalsService.createGoal(req.body));
}));

app.get("/api/goals/:id", handle(async (req, res) => {
  const goal = await goalsService.getGoal(Number(req.params.id));
  if (!goal) return res.status(404).json({ error: "Meta no encontrada." });
  res.json(goal);
}));

app.put("/api/goals/:id", handle(async (req, res) => {
  const goal = await goalsService.updateGoal(Number(req.params.id), req.body);
  if (!goal) return res.status(404).json({ error: "Meta no encontrada." });
  res.json(goal);
}));

app.delete("/api/goals/:id", handle(async (req, res) => {
  const deleted = await goalsService.deleteGoal(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Meta no encontrada." });
  res.status(204).send();
}));

app.get("/api/goals/:id/contributions", handle(async (req, res) => {
  res.json(await goalsService.listContributions(Number(req.params.id)));
}));

app.post("/api/goals/:id/contributions", handle(async (req, res) => {
  res.status(201).json(
    await goalsService.addContribution(Number(req.params.id), req.body)
  );
}));

app.delete("/api/contributions/:id", handle(async (req, res) => {
  const deleted = await goalsService.deleteContribution(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Aporte no encontrado." });
  res.status(204).send();
}));

// ---- Tarjetas de crédito ----
app.get("/api/credit-cards", handle(async (req, res) => {
  res.json(await creditCardsService.listCreditCards());
}));

app.post("/api/credit-cards", handle(async (req, res) => {
  res.status(201).json(await creditCardsService.createCreditCard(req.body));
}));

app.get("/api/credit-cards/:id", handle(async (req, res) => {
  const card = await creditCardsService.getCreditCard(Number(req.params.id));
  if (!card) return res.status(404).json({ error: "Tarjeta no encontrada." });
  res.json(card);
}));

app.put("/api/credit-cards/:id", handle(async (req, res) => {
  const card = await creditCardsService.updateCreditCard(Number(req.params.id), req.body);
  if (!card) return res.status(404).json({ error: "Tarjeta no encontrada." });
  res.json(card);
}));

app.delete("/api/credit-cards/:id", handle(async (req, res) => {
  const deleted = await creditCardsService.deleteCreditCard(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: "Tarjeta no encontrada." });
  res.status(204).send();
}));

// ---- Resumen ----
app.get("/api/summary", handle(async (req, res) => {
  res.json(
    await transactionsService.getSummary({
      month: req.query.month,
      account_id: req.query.account_id,
    })
  );
}));

// ---- Widgets del dashboard ----
app.get("/api/dashboard/widgets", handle(async (req, res) => {
  res.json(await dashboardService.getWidgets({ month: req.query.month }));
}));

// ---- WhatsApp Webhook (Meta Cloud API) ----
app.get("/api/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "solventa_wsp_secret";

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("[WhatsApp Webhook] Verificado con éxito por Meta.");
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

async function handleParsedTransaction(fromNumber, parsed, fallbackDescription) {
  if (!parsed) {
    await whatsappService.sendWhatsAppMessage(
      fromNumber,
      "⚠️ No pude entender el monto o concepto. Ejemplo de formato:\n\n• *Gasté 25 soles en almuerzo con Yape*\n• *Ingreso 1500 sueldo BCP*"
    );
    return;
  }

  await transactionsService.createTransaction({
    account_id: parsed.account_id,
    category_id: parsed.category_id,
    type: parsed.type,
    amount: parsed.amount,
    description: parsed.description || fallbackDescription,
  });

  const iconType = parsed.type === "ingreso" ? "📈 *Ingreso Registrado*" : "💸 *Gasto Registrado*";
  const replyMsg = `${iconType}\n\n` +
    `💰 *Monto:* S/ ${parsed.amount.toFixed(2)}\n` +
    `🏷️ *Categoría:* ${parsed.category ? parsed.category.name : "General"}\n` +
    `💳 *Cuenta:* ${parsed.account ? parsed.account.name : "Principal"}\n` +
    `📝 *Detalle:* ${parsed.description || fallbackDescription}\n\n` +
    `✅ _Registrado automáticamente en Solventa_`;

  await whatsappService.sendWhatsAppMessage(fromNumber, replyMsg);
}

app.post("/api/whatsapp/webhook", handle(async (req, res) => {
  const body = req.body;

  if (body.object === "whatsapp_business_account") {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message && message.type === "text") {
      const fromNumber = message.from;
      const userText = message.text.body;

      console.log(`[WhatsApp Webhook] Mensaje recibido de ${fromNumber}: "${userText}"`);

      try {
        const parsed = await whatsappParser.parseTransactionFromText(userText);
        await handleParsedTransaction(fromNumber, parsed, userText);
      } catch (err) {
        console.error("[WhatsApp Process Error]", err);
        await whatsappService.sendWhatsAppMessage(
          fromNumber,
          `❌ Error al registrar la transacción: ${err.message}`
        );
      }
    } else if (message && message.type === "audio") {
      const fromNumber = message.from;
      const mediaId = message.audio.id;

      console.log(`[WhatsApp Webhook] Audio recibido de ${fromNumber} (media_id: ${mediaId})`);

      try {
        const media = await whatsappService.downloadWhatsAppMedia(mediaId);
        if (!media) {
          throw new Error("No pude descargar la nota de voz.");
        }

        const parsed = await whatsappParser.parseTransactionFromAudio(media.buffer, media.mimeType);
        await handleParsedTransaction(fromNumber, parsed, "Gasto registrado por nota de voz");
      } catch (err) {
        console.error("[WhatsApp Process Error]", err);
        await whatsappService.sendWhatsAppMessage(
          fromNumber,
          `❌ Error al procesar la nota de voz: ${err.message}`
        );
      }
    }
  }

  res.status(200).send("EVENT_RECEIVED");
}));

let dbInitPromise = null;
app.use(async (req, res, next) => {
  if (!dbInitPromise) {
    dbInitPromise = db.init();
  }
  await dbInitPromise;
  next();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
