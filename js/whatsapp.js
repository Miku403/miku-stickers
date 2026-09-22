const BRIDGE_SCHEME = "mikustickers://";
const BRIDGE_IMPORT_PATH = "import";

let bridgeCallback = null;


/**
 * إرسال حزمة Miku Stickers إلى تطبيق iOS Native Bridge
 *
 * مهم:
 * لا نضع الـ JSON كاملًا داخل URL لأن الحزمة قد تكون
 * كبيرة جدًا، خصوصًا مع 30 صورة Base64.
 *
 * لذلك هذه الطبقة تستخدم postMessage إذا كان الموقع
 * مفتوحًا داخل WebView/Bridge.
 */
export async function sendToWhatsApp(pack) {

  if (!pack) {
    throw new Error("لا توجد حزمة جاهزة");
  }


  /*
   * الطريقة الأولى:
   * Native WKWebView message handler
   */
  if (
    window.webkit &&
    window.webkit.messageHandlers &&
    window.webkit.messageHandlers.mikuStickers
  ) {

    window.webkit.messageHandlers
      .mikuStickers
      .postMessage({
        action: "importPack",
        pack: pack
      });

    return {
      method: "webkit",
      success: true
    };
  }


  /*
   * الطريقة الثانية:
   * تطبيق Native يمكنه استقبال
   * custom URL scheme.
   *
   * هنا نرسل فقط نسخة صغيرة من البيانات
   * أو ID مستقبلي، وليس Base64 كاملًا.
   */
  const packId =
    await createTemporaryPack(pack);


  const url =
    `${BRIDGE_SCHEME}${BRIDGE_IMPORT_PATH}` +
    `?id=${encodeURIComponent(packId)}`;


  bridgeCallback = {
    packId,
    createdAt: Date.now()
  };


  window.location.href = url;


  return {
    method: "url",
    success: true,
    packId
  };
}


/**
 * تخزين الحزمة مؤقتًا.
 *
 * حاليًا localStorage.
 *
 * لاحقًا يمكن استبداله بـ:
 * - App Group
 * - server
 * - Universal Link
 * - Native bridge storage
 */
async function createTemporaryPack(pack) {

  const id =
    `miku_${Date.now()}_${randomId()}`;


  const key =
    `miku_sticker_pack_${id}`;


  localStorage.setItem(
    key,
    JSON.stringify(pack)
  );


  return id;
}


function randomId() {

  if (
    window.crypto &&
    crypto.randomUUID
  ) {

    return crypto.randomUUID();
  }


  return Math.random()
    .toString(36)
    .slice(2) +
    Date.now().toString(36);
}


/**
 * يستعمله الـ Native Bridge لاحقًا
 * إذا احتجنا إرسال نتيجة العملية للموقع.
 */
export function handleBridgeResult(result) {

  window.dispatchEvent(
    new CustomEvent(
      "mikuBridgeResult",
      {
        detail: result
      }
    )
  );
}


export function getTemporaryPack(id) {

  const key =
    `miku_sticker_pack_${id}`;


  const data =
    localStorage.getItem(key);


  if (!data) {
    return null;
  }


  try {

    return JSON.parse(data);

  } catch {

    return null;
  }
}


export function deleteTemporaryPack(id) {

  localStorage.removeItem(
    `miku_sticker_pack_${id}`
  );
}
