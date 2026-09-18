require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
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
// ALLOWED_ORIGINS (separados por coma) restringe qué webs pueden llamar a
// esta API desde el navegador. Cualquier *.vercel.app y localhost siempre
// están permitidos (para previews de Vercel y desarrollo local); agrega ahí
// tu dominio final cuando lo tengas fijo para cerrarlo del todo.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // llamadas server-to-server (ej. Meta) no mandan Origin
      if (allowedOrigins.includes(origin)) return callback(null, true);
      try {
        const hostname = new URL(origin).hostname;
        if (hostname === "localhost" || hostname.endsWith(".vercel.app")) {
          return callback(null, true);
        }
      } catch {
        // origin no es una URL válida, cae al rechazo de abajo
      }
      callback(new Error("Origen no permitido por CORS."));
    },
  })
);
app.use(express.json());

// ---- Rate limiting ----
// Límite generoso mientras es solo tu propio uso; frena bots/escaneos
// automáticos si alguien encuentra la URL de la API.
app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 120 }));
// El webhook de WhatsApp lo llama Meta con su propio patrón de reintentos;
// un límite más alto evita bloquear entregas legítimas, solo frena abuso.
app.use("/api/whatsapp/webhook", rateLimit({ windowMs: 60 * 1000, max: 60 }));

// ---- Autenticación por API key ----
// Esta API es de uso personal: sin esto, cualquiera que encuentre la URL
// desplegada puede leer y modificar tus cuentas y transacciones. Todas las
// rutas /api/* (menos el webhook, que Meta llama directo sin este header)
// exigen "Authorization: Bearer <API_KEY>".
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.warn(
    "[Seguridad] No se definió API_KEY: la API está corriendo SIN autenticación."
  );
}

app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/whatsapp/webhook")) return next();
  if (!API_KEY) return next();

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token !== API_KEY) {
    return res.status(401).json({ error: "No autorizado." });
  }
  next();
});

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

app.post("/api/transactions/installments", handle(async (req, res) => {
  res.status(201).json(await transactionsService.createInstallmentPurchase(req.body));
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

app.post("/api/credit-cards/:id/payments", handle(async (req, res) => {
  const card = await creditCardsService.markPaymentPaid(Number(req.params.id), req.body.due_date);
  if (!card) return res.status(404).json({ error: "Tarjeta no encontrada." });
  res.status(201).json(card);
}));

app.delete("/api/credit-cards/:id/payments/:dueDate", handle(async (req, res) => {
  const card = await creditCardsService.unmarkPaymentPaid(Number(req.params.id), req.params.dueDate);
  if (!card) return res.status(404).json({ error: "Tarjeta no encontrada." });
  res.json(card);
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

// Si defines WHATSAPP_OWNER_NUMBER, solo los mensajes de ese número se
// procesan (evita que cualquiera que te escriba al bot registre gastos en
// tus cuentas). Sin configurar, no bloquea nada (compatibilidad).
const WHATSAPP_OWNER_NUMBER = process.env.WHATSAPP_OWNER_NUMBER;

app.post("/api/whatsapp/webhook", handle(async (req, res) => {
  const body = req.body;

  if (body.object === "whatsapp_business_account") {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message && WHATSAPP_OWNER_NUMBER && message.from !== WHATSAPP_OWNER_NUMBER) {
      console.warn(`[WhatsApp Webhook] Mensaje ignorado de número no autorizado: ${message.from}`);
      return res.status(200).send("EVENT_RECEIVED");
    }

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
    } else if (message && message.type === "image") {
      const fromNumber = message.from;
      const mediaId = message.image.id;
      const caption = message.image.caption;

      console.log(`[WhatsApp Webhook] Imagen recibida de ${fromNumber} (media_id: ${mediaId})${caption ? ` con caption: "${caption}"` : ""}`);

      try {
        const media = await whatsappService.downloadWhatsAppMedia(mediaId);
        if (!media) {
          throw new Error("No pude descargar la imagen.");
        }

        const parsed = await whatsappParser.parseTransactionFromImage(media.buffer, media.mimeType, caption);
        await handleParsedTransaction(fromNumber, parsed, "Gasto registrado por foto de comprobante/boleta");
      } catch (err) {
        console.error("[WhatsApp Process Error]", err);
        await whatsappService.sendWhatsAppMessage(
          fromNumber,
          `❌ Error al procesar la imagen: ${err.message}`
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
