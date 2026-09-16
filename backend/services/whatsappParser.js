const db = require("../db");
const categoriesService = require("./categories");

/**
 * Servicio para interpretar mensajes en lenguaje natural e identificarlos como transacciones.
 */

const CATEGORY_GUIDE = `
Guía de qué categoría de gasto usar según el concepto (úsala como referencia, no es una lista cerrada):
- Alimentación: almuerzo, cena, desayuno, restaurante, delivery, mercado, supermercado, comida.
- Transporte: taxi, uber, cabify, pasaje, combi, gasolina, peaje, estacionamiento.
- Vivienda: alquiler, renta, luz, agua, internet, gas, mantenimiento.
- Entretenimiento: cine, salida, fiesta, bar, discoteca, videojuego, concierto.
- Salud: farmacia, doctor, médico, medicina, consulta, seguro, dentista.
- Educación: curso, universidad, instituto, libros, colegio, matrícula.
- streaming: suscripciones de Netflix, Spotify, Disney+, YouTube Premium, etc.
- Otros: cualquier gasto que no encaje claramente en las anteriores.

Para ingresos usa: Sueldo (pago de trabajo formal), Freelance (trabajo independiente), Regalo (dinero recibido de otra persona), Otros (cualquier otro ingreso).
`;

const ACCOUNT_ALIAS_GUIDE = `
Alias de cuentas (úsalos siempre que se mencione alguna de estas formas, aunque no coincida textualmente con el nombre de la cuenta):
- "CMR", "C M R", "cmr credito" -> cuenta "CMR Credito".
- "Falabella", "banco falabella" -> cuenta "Banco Falabella".
- "tarjeta de alimento", "tarjeta de alimentos", "vales" -> cuenta "Tarjeta de Alimentos".
- "Plin" -> cuenta "Scotiabank" (el Plin de este usuario está vinculado a esa cuenta).
- "Yape" -> cuenta "YAPE".
`;

function buildTransactionRules(unitLabel) {
  return `
Reglas:
- Si ${unitLabel} indica pagar, gastar, comprar, costo o salida de dinero -> "type": "gasto".
- Si ${unitLabel} indica recibir, cobro, ingreso, abono, sueldo, transferencia a favor -> "type": "ingreso".
- Elije siempre la category_id que mejor coincida con el concepto, usando la guía de categorías de arriba. Debe ser de tipo coherente ("gasto" o "ingreso"). Si ninguna encaja bien, usa la categoría "Otros" del tipo correspondiente — nunca dejes de responder por no encontrar una categoría exacta.
- Elije la account_id solo si ${unitLabel} menciona claramente el nombre o alias de una cuenta de la lista (usa la guía de alias de arriba). Si no menciona ninguna o no coincide con nada, usa la primera cuenta disponible.
`;
}

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
Eres un asistente financiero peruano que analiza mensajes de WhatsApp para registrar ingresos y gastos.
Analiza el siguiente texto y devuelve EXCLUSIVAMENTE un objeto JSON válido (sin bloques de markdown ni texto extra).

Texto del usuario: "${userText}"

Categorías disponibles (usa SIEMPRE uno de estos IDs, nunca inventes uno):
${categoriesPrompt}
${CATEGORY_GUIDE}
Cuentas disponibles (usa SIEMPRE uno de estos IDs, nunca inventes uno):
${accountsPrompt}
${ACCOUNT_ALIAS_GUIDE}
Estructura JSON esperada:
{
  "type": "gasto" o "ingreso",
  "amount": numero_flotante_positivo,
  "category_id": id_categoria_elegida,
  "account_id": id_cuenta_elegida,
  "description": "breve descripcion limpia extraida del mensaje"
}
${buildTransactionRules("el texto")}- Si no hay un monto válido en el texto, devuelve JSON con "error": "No se encontró el monto".
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
        },
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
Eres un asistente financiero peruano que escucha notas de voz de WhatsApp para registrar ingresos y gastos.

Primero transcribe mentalmente el audio completo, con especial cuidado en los números y montos de dinero
dichos en voz alta (ej: "veinticinco soles" = 25, "treinta y cinco con cincuenta" = 35.50, "cien lucas" = 100,
"quince con noventa" = 15.90). El audio puede tener ruido de fondo, palabras cortas poco claras o acento
peruano; usa el contexto de toda la frase para inferir el monto y el concepto aunque una palabra puntual no
se escuche perfecto — evita responder "error" salvo que sea realmente imposible identificar un monto.

Después de transcribir, devuelve EXCLUSIVAMENTE un objeto JSON válido (sin bloques de markdown ni texto extra).

Categorías disponibles (usa SIEMPRE uno de estos IDs, nunca inventes uno):
${categoriesPrompt}
${CATEGORY_GUIDE}
Cuentas disponibles (usa SIEMPRE uno de estos IDs, nunca inventes uno):
${accountsPrompt}
${ACCOUNT_ALIAS_GUIDE}
Estructura JSON esperada:
{
  "type": "gasto" o "ingreso",
  "amount": numero_flotante_positivo,
  "category_id": id_categoria_elegida,
  "account_id": id_cuenta_elegida,
  "description": "breve descripcion limpia extraida del audio"
}
${buildTransactionRules("el audio")}- Si de verdad no se distingue ningún monto en el audio, devuelve JSON con "error": "No se encontró el monto".
`;

  // Meta suele mandar "audio/ogg; codecs=opus"; Gemini solo acepta el mime type base.
  const cleanMimeType = (mimeType || "audio/ogg").split(";")[0].trim();

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
                  mime_type: cleanMimeType,
                  data: audioBuffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
        },
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[WhatsApp Parser Gemini Audio Error] HTTP ${res.status}:`, errorBody);
      return null;
    }
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

async function transcribeAudioWithWhisper(audioBuffer, mimeType) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  // Diagnóstico: detectar si la env var llegó corrupta (ej. autocorrección al pegarla)
  // sin loguear la key completa.
  const nonAsciiChars = [...apiKey].filter((c) => c.charCodeAt(0) > 255);
  if (nonAsciiChars.length > 0) {
    console.error(
      `[WhatsApp Parser Whisper] OPENAI_API_KEY parece corrupta: ${nonAsciiChars.length} caracter(es) no-ASCII, longitud total ${apiKey.length}`
    );
  }

  try {
    const cleanMimeType = (mimeType || "audio/ogg").split(";")[0].trim();
    const extension = cleanMimeType.includes("ogg") ? "ogg" : cleanMimeType.includes("mp4") ? "mp4" : "ogg";

    console.log(
      `[WhatsApp Parser Whisper] mimeType original="${mimeType}" limpio="${cleanMimeType}" bufferBytes=${audioBuffer.length}`
    );

    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: cleanMimeType }), `audio.${extension}`);
    form.append("model", "whisper-1");
    form.append("language", "es");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[WhatsApp Parser Whisper Error] HTTP ${res.status}:`, errorBody);
      return null;
    }

    const data = await res.json();
    return data.text?.trim() || null;
  } catch (err) {
    console.error("[WhatsApp Parser Whisper Error]", err.stack || err);
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

async function resolveTransactionFromText(userText, categories, accounts) {
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

async function parseTransactionFromText(userText) {
  const [categories, accounts] = await Promise.all([
    categoriesService.listCategories(),
    db.all("SELECT * FROM accounts ORDER BY id ASC"),
  ]);

  if (!categories.length || !accounts.length) {
    throw new Error("No hay cuentas o categorías configuradas en la app.");
  }

  return resolveTransactionFromText(userText, categories, accounts);
}

async function parseTransactionFromAudio(audioBuffer, mimeType) {
  const [categories, accounts] = await Promise.all([
    categoriesService.listCategories(),
    db.all("SELECT * FROM accounts ORDER BY id ASC"),
  ]);

  if (!categories.length || !accounts.length) {
    throw new Error("No hay cuentas o categorías configuradas en la app.");
  }

  // Preferido: transcribir con Whisper y reusar el mismo pipeline de texto
  // (Gemini + fallback de regex), en vez de que Gemini escuche el audio directo.
  const transcript = await transcribeAudioWithWhisper(audioBuffer, mimeType);
  if (transcript) {
    console.log(`[WhatsApp Parser] Audio transcrito con Whisper: "${transcript}"`);
    const result = await resolveTransactionFromText(transcript, categories, accounts);
    if (result) return result;
  }

  // Respaldo: si no hay Whisper configurado o falló, usar Gemini escuchando el audio directo.
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("No se pudo transcribir el audio y no hay GEMINI_API_KEY como respaldo.");
  }

  const fallbackResult = await parseMessageWithGeminiAudio(audioBuffer, mimeType, categories, accounts);

  if (!fallbackResult || !fallbackResult.amount) {
    return null;
  }

  return {
    ...fallbackResult,
    category: categories.find((c) => c.id === fallbackResult.category_id),
    account: accounts.find((a) => a.id === fallbackResult.account_id),
  };
}

module.exports = {
  parseTransactionFromText,
  parseTransactionFromAudio,
};
