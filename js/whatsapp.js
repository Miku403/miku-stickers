export async function sendToWhatsApp(pack) {

  /*
    Web-only fallback.

    هذا يفتح WhatsApp فقط.
    الاستيراد الحقيقي يحتاج
    Native iOS bridge.
  */

  const url =
    "whatsapp://stickerPack";

  window.location.href = url;

  return true;
}
