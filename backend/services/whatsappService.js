/**
 * Servicio para enviar mensajes de WhatsApp usando Meta WhatsApp Cloud API
 */

async function sendWhatsAppMessage(toPhoneNumber, messageText) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn("[WhatsApp Service] Faltan variables WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en .env");
    return false;
  }

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toPhoneNumber,
        type: "text",
        text: {
          preview_url: false,
          body: messageText,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsApp Service Error]", data);
      throw new Error(data?.error?.message || `Error ${response.status} al responder por Meta API`);
    }

    console.log("[WhatsApp Service] Mensaje enviado con éxito:", data);
    return true;
  } catch (error) {
    console.error("[WhatsApp Service Error]", error);
    return false;
  }
}

module.exports = {
  sendWhatsAppMessage,
};
