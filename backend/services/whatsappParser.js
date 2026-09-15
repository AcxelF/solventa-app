const db = require("../db");
const categoriesService = require("./categories");

/**
 * Servicio para interpretar mensajes en lenguaje natural e identificarlos como transacciones.
 */

async function parseMessageWithGemini(userText, categories, accounts) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const categoriesPrompt = categories
    .map((c) => `ID: ${c.id}, Nombre: "${c.name}", Tipo: "${c.type}"`)
    .join("\n");

  const accountsPrompt = accounts
    .map((a) => `ID: ${a.id}, Nombre: "${a.name}"`)
    .join("\n");

  const prompt = `
Eres un asistente financiero que analiza mensajes de WhatsApp para registrar ingresos y gastos.
Analiza el siguiente texto y devuelve EXCLUSIVAMENTE un objeto JSON válido (sin bloques de markdown ni texto extra).

Texto del usuario: "${userText}"

Categorías disponibles:
${categoriesPrompt}

Cuentas disponibles:
${accountsPrompt}

Estructura JSON esperada:
{
  "type": "gasto" o "ingreso",
  "amount": numero_flotante_positivo,
  "category_id": id_categoria_elegida,
  "account_id": id_cuenta_elegida,
  "description": "breve descripcion limpia extraida del mensaje"
}

Reglas:
- Si el texto indica pagar, gastar, comprar, costo o salida de dinero -> "type": "gasto".
- Si el texto indica recibir, cobro, ingreso, abono, sueldo, transferencia a favor -> "type": "ingreso".
- Elije la category_id que mejor coincida con el concepto. Debe ser de tipo coherente ("gasto" o "ingreso").
- Elije la account_id mencionada (ej: Yape, Plin, BCP, Efectivo). Si no menciona ninguna, usa la primera cuenta disponible.
- Si no hay un monto válido en el texto, devuelve JSON con "error": "No se encontró el monto".
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Limpiar posibles bloques ```json ... ```
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(rawText);
    if (parsed.error) return null;
    return parsed;
  } catch (err) {
    console.error("[WhatsApp Parser Gemini Error]", err);
    return null;
  }
}

async function parseMessageWithGeminiAudio(audioBuffer, mimeType, categories, accounts) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const categoriesPrompt = categories
    .map((c) => `ID: ${c.id}, Nombre: "${c.name}", Tipo: "${c.type}"`)
    .join("\n");

  const accountsPrompt = accounts
    .map((a) => `ID: ${a.id}, Nombre: "${a.name}"`)
    .join("\n");

  const prompt = `
Eres un asistente financiero que escucha notas de voz de WhatsApp para registrar ingresos y gastos.
Escucha el audio adjunto y devuelve EXCLUSIVAMENTE un objeto JSON válido (sin bloques de markdown ni texto extra).

Categorías disponibles:
${categoriesPrompt}

Cuentas disponibles:
${accountsPrompt}

Estructura JSON esperada:
{
  "type": "gasto" o "ingreso",
  "amount": numero_flotante_positivo,
  "category_id": id_categoria_elegida,
  "account_id": id_cuenta_elegida,
  "description": "breve descripcion limpia extraida del audio"
}

Reglas:
- Si el audio indica pagar, gastar, comprar, costo o salida de dinero -> "type": "gasto".
- Si el audio indica recibir, cobro, ingreso, abono, sueldo, transferencia a favor -> "type": "ingreso".
- Elije la category_id que mejor coincida con el concepto. Debe ser de tipo coherente ("gasto" o "ingreso").
- Elije la account_id mencionada (ej: Yape, Plin, BCP, Efectivo). Si no menciona ninguna, usa la primera cuenta disponible.
- Si no se entiende un monto válido en el audio, devuelve JSON con "error": "No se encontró el monto".
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: audioBuffer.toString("base64"),
                },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(rawText);
    if (parsed.error) return null;
    return parsed;
  } catch (err) {
    console.error("[WhatsApp Parser Gemini Audio Error]", err);
    return null;
  }
}

function parseMessageRegex(userText, categories, accounts) {
  const textLower = userText.toLowerCase();

  // 1. Detectar Tipo
  let type = "gasto";
  if (
    textLower.includes("ingreso") ||
    textLower.includes("cobré") ||
    textLower.includes("cobre") ||
    textLower.includes("gané") ||
    textLower.includes("gane") ||
    textLower.includes("sueldo") ||
    textLower.includes("depósito") ||
    textLower.includes("deposito") ||
    textLower.includes("recibí") ||
    textLower.includes("recibi")
  ) {
    type = "ingreso";
  }

  // 2. Extraer Monto
  // Busca patrones como "S/ 50", "50.50", "20 soles", "100"
  const amountMatch = textLower.match(/(?:s\/\s*|\$\s*|soles\s*)?(\d+(?:[\.,]\d{1,2})?)/);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(",", "."));
  if (isNaN(amount) || amount <= 0) return null;

  // 3. Matchear Cuenta
  let accountId = accounts[0]?.id || 1;
  for (const acc of accounts) {
    if (textLower.includes(acc.name.toLowerCase())) {
      accountId = acc.id;
      break;
    }
  }

  // 4. Matchear Categoría
  const validCategories = categories.filter((c) => c.type === type);
  let categoryId = validCategories[0]?.id || (type === "gasto" ? 1 : 2);

  for (const cat of validCategories) {
    if (textLower.includes(cat.name.toLowerCase())) {
      categoryId = cat.id;
      break;
    }
  }

  return {
    type,
    amount,
    category_id: categoryId,
    account_id: accountId,
    description: userText.trim(),
  };
}

async function parseTransactionFromText(userText) {
  const [categories, accounts] = await Promise.all([
    categoriesService.listCategories(),
    db.all("SELECT * FROM accounts ORDER BY id ASC"),
  ]);

  if (!categories.length || !accounts.length) {
    throw new Error("No hay cuentas o categorías configuradas en la app.");
  }

  // Intentar con Gemini AI si está disponible (con fallback seguro)
  let result = null;
  try {
    result = await parseMessageWithGemini(userText, categories, accounts);
  } catch (err) {
    console.error("[WhatsApp Parser Gemini Fallback]", err);
  }

  // Fallback a Regex inteligente
  if (!result) {
    result = parseMessageRegex(userText, categories, accounts);
  }

  if (!result || !result.amount) {
    return null;
  }

  return {
    ...result,
    category: categories.find((c) => c.id === result.category_id),
    account: accounts.find((a) => a.id === result.account_id),
  };
}

async function parseTransactionFromAudio(audioBuffer, mimeType) {
  const [categories, accounts] = await Promise.all([
    categoriesService.listCategories(),
    db.all("SELECT * FROM accounts ORDER BY id ASC"),
  ]);

  if (!categories.length || !accounts.length) {
    throw new Error("No hay cuentas o categorías configuradas en la app.");
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Las notas de voz requieren GEMINI_API_KEY configurada (no hay fallback sin IA para audio).");
  }

  const result = await parseMessageWithGeminiAudio(audioBuffer, mimeType, categories, accounts);

  if (!result || !result.amount) {
    return null;
  }

  return {
    ...result,
    category: categories.find((c) => c.id === result.category_id),
    account: accounts.find((a) => a.id === result.account_id),
  };
}

module.exports = {
  parseTransactionFromText,
  parseTransactionFromAudio,
};
