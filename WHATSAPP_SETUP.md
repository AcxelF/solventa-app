# Guía de Configuración: WhatsApp Cloud API (Meta) -> Solventa

Esta guía documenta la arquitectura, variables de entorno y el **paso crítico de la API de Graph** necesario para conectar Meta WhatsApp Cloud API con el backend de Solventa.

---

## 🔑 Variables de Entorno Requeridas en el Backend (Vercel)

| Variable | Descripción |
| :--- | :--- |
| `TURSO_DATABASE_URL` | URL de la base de datos Turso (`https://...`) |
| `TURSO_AUTH_TOKEN` | Token de autenticación de Turso |
| `WHATSAPP_TOKEN` | Token de acceso de Meta (expira cada 24h en desarrollo) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de prueba de WhatsApp |
| `WHATSAPP_VERIFY_TOKEN` | Token secreto para verificación (`solventa_wsp_secret`) |

---

## ⚡ El Paso Crítico (WABA Subscribed Apps)

> [!IMPORTANT]
> **La interfaz web de Meta Developers NO muestra el botón para suscribir la App a la cuenta de WhatsApp Business (WABA).**
> Si este paso no se ejecuta mediante la Graph API, Meta **no enviará ningún evento webhook** (fallo en silencio total sin logs).

### Comando para suscribir la App a la WABA:

```bash
curl -X POST "https://graph.facebook.com/v21.0/{WABA_ID}/subscribed_apps" \
  -H "Authorization: Bearer {WHATSAPP_TOKEN}"
```

- Reemplazar `{WABA_ID}` por el **WhatsApp Business Account ID** (ej: `143770804153324`).
- Reemplazar `{WHATSAPP_TOKEN}` por el token vigente de Meta.

---

## 🔄 Flujo de Trabajo y Mensajes Soportados

El backend procesa mensajes en lenguaje natural a través de `services/whatsappParser.js`:
- 💸 *"Gasté 30 soles en almuerzo con Yape"* ➔ Gasto de S/ 30.00 en Comida / Yape
- 📈 *"Ingreso 1500 sueldo BCP"* ➔ Ingreso de S/ 1500.00 en Sueldo / BCP
