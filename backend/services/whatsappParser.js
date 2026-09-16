const db = require("../db");
const categoriesService = require("./categories");

/**
 * Servicio para interpretar mensajes en lenguaje natural e identificarlos como transacciones.
 */

// Fuente única de verdad: se usa tanto para armar el prompt de Gemini como
// para el fallback de regex, así ambos quedan siempre sincronizados.
const CATEGORY_KEYWORDS = {
  "Alimentación": ["almuerzo", "cena", "desayuno", "restaurante", "delivery", "mercado", "supermercado", "comida"],
  "Transporte": ["taxi", "uber", "cabify", "pasaje", "combi", "gasolina", "peaje", "estacionamiento"],
  "Vivienda": ["alquiler", "renta", "luz", "agua", "internet", "gas natural", "mantenimiento", "arriendo"],
  "Entretenimiento": ["cine", "salida", "fiesta", "bar", "discoteca", "videojuego", "concierto"],
  "Salud": ["farmacia", "doctor", "médico", "medico", "medicina", "consulta", "seguro", "dentista"],
  "Educación": ["curso", "universidad", "instituto", "libros", "colegio", "matrícula", "matricula"],
  "streaming": ["netflix", "spotify", "disney", "youtube premium", "suscripción", "suscripcion"],
  "Otros": ["ropa", "zapatillas", "zapatos", "regalo", "vestimenta", "compras"],
};

const INCOME_CATEGORY_KEYWORDS = {
  "Sueldo": ["sueldo", "salario"],
  "Freelance": ["freelance", "independiente"],
  "Regalo": ["regalo"],
};

const ACCOUNT_ALIASES = {
  "CMR Credito": ["cmr", "c m r", "cmr credito", "cemerre"],
  "Banco Falabella": ["falabella", "banco falabella"],
  "Tarjeta de Alimentos": ["tarjeta de alimento", "tarjeta de alimentos", "vales"],
  "Scotiabank": ["plin", "scotiabank"],
  "YAPE": ["yape"],
};

function buildCategoryGuideText() {
  const gastoLines = Object.entries(CATEGORY_KEYWORDS)
    .map(([name, keywords]) => `- ${name}: ${keywords.join(", ")}${name === "Otros" ? ", o cualquier gasto que no encaje en las demás categorías" : ""}.`)
    .join("\n");
  const ingresoLines = Object.entries(INCOME_CATEGORY_KEYWORDS)
    .map(([name, keywords]) => `${name} (${keywords.join(", ")})`)
    .join(", ");

  return `
Guía de qué categoría de gasto usar según el concepto (úsala como referencia, no es una lista cerrada):
${gastoLines}

Para ingresos usa: ${ingresoLines}, Otros (cualquier otro ingreso).
`;
}

function buildAccountAliasGuideText() {
  const lines = Object.entries(ACCOUNT_ALIASES)
    .map(([name, aliases]) => `- ${aliases.map((a) => `"${a}"`).join(", ")} -> cuenta "${name}".`)
    .join("\n");

  return `
Alias de cuentas (úsalos siempre que se mencione alguna de estas formas, aunque no coincida textualmente con el nombre de la cuenta):
${lines}
`;
}

const CATEGORY_GUIDE = buildCategoryGuideText();
const ACCOUNT_ALIAS_GUIDE = buildAccountAliasGuideText();

function buildTransactionRules(unitLabel) {
  return `
Reglas:
- Si ${unitLabel} indica pagar, gastar, comprar, costo o salida de dinero -> "type": "gasto".
- Si ${unitLabel} indica recibir, cobro, ingreso, abono, sueldo, transferencia a favor -> "type": "ingreso".
- Elije siempre la category_id que mejor coincida con el concepto, usando la guía de categorías de arriba. Debe ser de tipo coherente ("gasto" o "ingreso"). Si ninguna encaja bien, usa la categoría "Otros" del tipo correspondiente — nunca dejes de responder por no encontrar una categoría exacta.
- Elije la account_id solo si ${unitLabel} menciona claramente el nombre o alias de una cuenta de la lista (usa la guía de alias de arriba). Si no menciona ninguna o no coincide con nada, usa la primera cuenta disponible.
`;
}

function buildTextPrompt(userText, categories, accounts) {
  const categoriesPrompt = categories
    .map((c) => `ID: ${c.id}, Nombre: "${c.name}", Tipo: "${c.type}"`)
    .join("\n");

  const accountsPrompt = accounts
    .map((a) => `ID: ${a.id}, Nombre: "${a.name}"`)
    .join("\n");

  return `
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
}

function cleanAndParseJson(rawText) {
  const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (parsed.error) return null;
  return parsed;
}

async function parseMessageWithGroq(userText, categories, accounts) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const prompt = buildTextPrompt(userText, categories, accounts);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[WhatsApp Parser Groq Error] HTTP ${res.status}:`, errorBody);
      return null;
    }

    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content || "";
    return cleanAndParseJson(rawText);
  } catch (err) {
    console.error("[WhatsApp Parser Groq Error]", err.stack || err);
    return null;
  }
}

async function parseMessageWithGemini(userText, categories, accounts) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = buildTextPrompt(userText, categories, accounts);

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

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[WhatsApp Parser Gemini Error] HTTP ${res.status}:`, errorBody);
      return null;
    }
    const data = await res.json();
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Limpiar posibles bloques ```json ... ```
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(rawText);
    if (parsed.error) {
      console.log(`[WhatsApp Parser Gemini] Devolvió error de negocio: ${parsed.error}`);
      return null;
    }
    return parsed;
  } catch (err) {
    console.error("[WhatsApp Parser Gemini Error]", err.stack || err);
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

// Coincidencia por palabra/frase completa: evita falsos positivos como
// "gas" adentro de "gasté" (que activaba Vivienda en cualquier gasto).
function containsPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = "[^a-záéíóúñü0-9]";
  const regex = new RegExp(`(^|${boundary})${escaped}(${boundary}|$)`, "i");
  return regex.test(text);
}

// Después de encontrar el monto en un texto de OCR (captura de Yape/Plin/boleta),
// el nombre de la persona o negocio suele aparecer en la línea siguiente.
// Esto filtra etiquetas típicas de la interfaz que no son nombres reales.
const OCR_NOISE_LINES = [
  "compartir", "código de seguridad", "codigo de seguridad", "datos de la transacción",
  "datos de la transaccion", "nro. de celular", "nro de celular", "destino",
  "nro. de operación", "nro de operacion", "más en", "mas en", "nuevo",
  "aprovecha", "crédito", "credito", "preaprobado", "ir a créditos", "ir a creditos",
  "yape", "plin", "yapeaste", "recibiste",
];

function extractLikelyNameAfter(originalText, fromIndex) {
  const rest = originalText.slice(fromIndex);
  const lines = rest.split(/\r?\n|\s{2,}/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines.slice(0, 4)) {
    const lower = line.toLowerCase();
    if (OCR_NOISE_LINES.some((noise) => lower.includes(noise))) continue;
    if (/^\d+([.,]\d+)?$/.test(line)) continue;
    if (/^[a-záéíóúñ][a-záéíóúñ*.\s]{2,39}$/i.test(line)) {
      return line;
    }
  }
  return null;
}

function parseMessageRegex(userText, categories, accounts) {
  const textLower = userText.toLowerCase();

  // 1. Detectar Tipo
  let type = "gasto";
  const incomeKeywords = ["ingreso", "cobré", "cobre", "gané", "gane", "sueldo", "depósito", "deposito", "recibí", "recibi"];
  if (incomeKeywords.some((kw) => containsPhrase(textLower, kw))) {
    type = "ingreso";
  }

  // 2. Extraer Monto
  // Prioridad 1: montos con símbolo de moneda explícito (incluye "SI"/"S1", que
  // es como el OCR suele leer mal el "S/" en capturas de Yape/Plin/boletas).
  // Prioridad 2 (fallback): cualquier número con formato de monto, pero
  // evitando falsos positivos obvios como horas ("1:18") o fechas.
  let amountMatch = textLower.match(/(?:s\/|soles|s1|\bsi\b)\s*[:\-]?\s*(\d+(?:[.,]\d{1,2})?)/);
  let usedCurrencyPattern = Boolean(amountMatch);

  if (!amountMatch) {
    amountMatch = textLower.match(/(?:^|\s)(\d+(?:[.,]\d{1,2})?)(?!\s*:\d)/);
  }

  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(",", "."));
  if (isNaN(amount) || amount <= 0) return null;

  // 3. Matchear Cuenta (primero por alias conocidos, luego por nombre exacto)
  let accountId = accounts[0]?.id || 1;
  let accountMatched = false;

  for (const [accountName, aliases] of Object.entries(ACCOUNT_ALIASES)) {
    if (aliases.some((alias) => containsPhrase(textLower, alias))) {
      const acc = accounts.find((a) => a.name.toLowerCase() === accountName.toLowerCase());
      if (acc) {
        accountId = acc.id;
        accountMatched = true;
        break;
      }
    }
  }

  if (!accountMatched) {
    for (const acc of accounts) {
      if (containsPhrase(textLower, acc.name.toLowerCase())) {
        accountId = acc.id;
        break;
      }
    }
  }

  // 4. Matchear Categoría (primero por keywords conocidos, luego por nombre exacto,
  // y si nada coincide, cae en "Otros" en vez de la primera categoría de la lista)
  const validCategories = categories.filter((c) => c.type === type);
  const otrosCategory = validCategories.find((c) => c.name.toLowerCase() === "otros");
  let categoryId = otrosCategory?.id ?? validCategories[0]?.id ?? (type === "gasto" ? 1 : 2);
  let categoryMatched = false;

  const keywordMap = type === "gasto" ? CATEGORY_KEYWORDS : INCOME_CATEGORY_KEYWORDS;
  for (const [categoryName, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => containsPhrase(textLower, kw))) {
      const cat = validCategories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
      if (cat) {
        categoryId = cat.id;
        categoryMatched = true;
        break;
      }
    }
  }

  if (!categoryMatched) {
    for (const cat of validCategories) {
      if (containsPhrase(textLower, cat.name.toLowerCase())) {
        categoryId = cat.id;
        categoryMatched = true;
        break;
      }
    }
  }

  // El texto crudo del OCR puede venir con muchas líneas (interfaz de la app,
  // botones, avisos). Si el monto se detectó con símbolo de moneda (típico de
  // capturas de Yape/Plin/boletas), intentamos sacar el nombre de la persona
  // o negocio que suele aparecer justo después ("Para: Paulino Cur*").
  let cleanDescription = userText.replace(/\s+/g, " ").trim().slice(0, 80);

  if (usedCurrencyPattern) {
    const name = extractLikelyNameAfter(userText, amountMatch.index + amountMatch[0].length);
    if (name) {
      cleanDescription = type === "ingreso" ? `De: ${name}` : `Para: ${name}`;
    }
  }

  return {
    type,
    amount,
    category_id: categoryId,
    account_id: accountId,
    description: cleanDescription,
  };
}

async function resolveTransactionFromText(userText, categories, accounts) {
  // 1. Intentar con Gemini AI si está disponible
  let result = null;
  try {
    result = await parseMessageWithGemini(userText, categories, accounts);
  } catch (err) {
    console.error("[WhatsApp Parser Gemini Fallback]", err);
  }

  // 2. Si Gemini falla (ej. tope diario de 20 peticiones del tier gratuito),
  // intentar con Groq (14,400 peticiones/día gratis) antes de caer al regex.
  if (!result) {
    try {
      result = await parseMessageWithGroq(userText, categories, accounts);
    } catch (err) {
      console.error("[WhatsApp Parser Groq Fallback]", err);
    }
  }

  // 3. Fallback final: Regex inteligente (siempre disponible, sin límite de uso)
  if (!result) {
    console.log(`[WhatsApp Parser] Gemini y Groq no devolvieron resultado, usando fallback de regex para: "${userText}"`);
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

async function describeTransactionImage(imageBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `
Eres un asistente financiero peruano. Esta imagen es una captura de pantalla de una app de pagos
(Yape, Plin, transferencia bancaria, Falabella, etc.) o una foto de una boleta/recibo de compra en papel.

Léela con cuidado y describe la transacción en UNA SOLA FRASE en español, en primera persona, con este formato:
"[Pagué/Recibí] [monto exacto] soles [a quién / en qué / dónde] [con qué medio de pago si es visible]"

Ejemplos de buena respuesta:
- "Pagué 25.50 soles a Juan Perez por Yape"
- "Pagué 85.90 soles en Tottus por abarrotes"
- "Recibí 500 soles por transferencia de Maria Garcia"
- "Pagué 40 soles en Inkafarma por medicinas"

Reglas:
- El monto debe ser el número EXACTO que aparece en la imagen (con decimales si los tiene).
- Si la imagen es de Yape/Plin, menciona ese medio de pago en la frase.
- Si es una boleta de tienda/restaurante, usa el nombre del establecimiento si es legible.
- Si de verdad no puedes leer ningún monto en la imagen, responde EXACTAMENTE: "ERROR: no se encontró un monto".
- No agregues explicaciones, solo la frase (o el mensaje de error exacto).
`;

  const cleanMimeType = (mimeType || "image/jpeg").split(";")[0].trim();

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
                  data: imageBuffer.toString("base64"),
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
      console.error(`[WhatsApp Parser Gemini Vision Error] HTTP ${res.status}:`, errorBody);
      return null;
    }

    const data = await res.json();
    const rawText = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

    if (!rawText || rawText.toUpperCase().startsWith("ERROR")) {
      return null;
    }

    return rawText;
  } catch (err) {
    console.error("[WhatsApp Parser Gemini Vision Error]", err.stack || err);
    return null;
  }
}

async function extractTextWithOcrSpace(imageBuffer, mimeType) {
  const apiKey = process.env.OCRSPACE_API_KEY;
  if (!apiKey) return null;

  try {
    const cleanMimeType = (mimeType || "image/jpeg").split(";")[0].trim();
    const extension = cleanMimeType.includes("png") ? "png" : "jpg";

    const form = new FormData();
    form.append("file", new Blob([imageBuffer], { type: cleanMimeType }), `image.${extension}`);
    form.append("language", "spa");
    form.append("OCREngine", "2");
    form.append("scale", "true");

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { "apikey": apiKey },
      body: form,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[WhatsApp Parser OCR Error] HTTP ${res.status}:`, errorBody);
      return null;
    }

    const data = await res.json();
    if (data.IsErroredOnProcessing) {
      console.error("[WhatsApp Parser OCR Error]", data.ErrorMessage || data);
      return null;
    }

    const text = data?.ParsedResults?.[0]?.ParsedText?.trim();
    return text || null;
  } catch (err) {
    console.error("[WhatsApp Parser OCR Error]", err.stack || err);
    return null;
  }
}

async function parseTransactionFromImage(imageBuffer, mimeType) {
  const [categories, accounts] = await Promise.all([
    categoriesService.listCategories(),
    db.all("SELECT * FROM accounts ORDER BY id ASC"),
  ]);

  if (!categories.length || !accounts.length) {
    throw new Error("No hay cuentas o categorías configuradas en la app.");
  }

  // Preferido: leer el texto de la imagen con OCR (barato/alto límite) y
  // reusar el mismo pipeline de texto (Gemini + Groq + regex), en vez de
  // depender de Gemini Vision para "entender" la imagen.
  const ocrText = await extractTextWithOcrSpace(imageBuffer, mimeType);
  if (ocrText) {
    console.log(`[WhatsApp Parser] Imagen leída con OCR: "${ocrText.replace(/\n/g, " | ")}"`);
    const result = await resolveTransactionFromText(ocrText, categories, accounts);
    if (result) return result;
  }

  // Respaldo: si no hay OCR configurado o no sacó nada usable, usar Gemini Vision.
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("No se pudo leer la imagen y no hay GEMINI_API_KEY como respaldo.");
  }

  const description = await describeTransactionImage(imageBuffer, mimeType);
  if (!description) {
    return null;
  }

  console.log(`[WhatsApp Parser] Imagen descrita por Gemini Vision: "${description}"`);
  return resolveTransactionFromText(description, categories, accounts);
}

module.exports = {
  parseTransactionFromText,
  parseTransactionFromImage,
  parseTransactionFromAudio,
};
