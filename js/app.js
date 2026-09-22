import {
  processSticker
} from "./stickers.js";

import {
  createPack
} from "./pack.js";

import {
  sendToWhatsApp
} from "./whatsapp.js";

import {
  formatBytes
} from "./utils.js";


const fileInput =
  document.getElementById("fileInput");

const packName =
  document.getElementById("packName");

const preview =
  document.getElementById("preview");

const status =
  document.getElementById("status");

const bridgeStatus =
  document.getElementById("bridgeStatus");

const createButton =
  document.getElementById("createButton");

const whatsappButton =
  document.getElementById("whatsappButton");


let processedStickers = [];
let currentPack = null;


/* =========================
   STATUS
========================= */

function setStatus(message) {

  status.textContent =
    message;

}


function setBridgeStatus(message) {

  if (!bridgeStatus) {
    return;
  }

  bridgeStatus.textContent =
    message;

}


/* =========================
   RESET
========================= */

function resetProject() {

  processedStickers = [];
  currentPack = null;

  preview.innerHTML = "";

  createButton.disabled =
    true;

  whatsappButton.disabled =
    true;

  setStatus("");

  setBridgeStatus("");

}


/* =========================
   IMAGE PREVIEW
========================= */

function createStickerCard(
  sticker,
  index
) {

  const card =
    document.createElement(
      "div"
    );

  card.className =
    "sticker-card";


  const img =
    document.createElement(
      "img"
    );

  img.src =
    URL.createObjectURL(
      sticker.blob
    );

  img.alt =
    `Sticker ${index + 1}`;


  const number =
    document.createElement(
      "div"
    );

  number.className =
    "sticker-number";

  number.textContent =
    `#${index + 1}`;


  const size =
    document.createElement(
      "div"
    );

  size.className =
    "sticker-size";

  size.textContent =
    `${sticker.width}×${sticker.height} • ` +
    `${formatBytes(sticker.size)}`;


  card.appendChild(img);

  card.appendChild(number);

  card.appendChild(size);


  return card;
}


/* =========================
   FILE INPUT
========================= */

fileInput.addEventListener(
  "change",
  async () => {

    resetProject();


    const files =
      Array.from(
        fileInput.files || []
      );


    /*
      WhatsApp sticker packs
      require 3–30 stickers.
    */

    if (
      files.length < 3 ||
      files.length > 30
    ) {

      setStatus(
        "اختر من 3 إلى 30 صورة."
      );

      return;
    }


    try {

      setStatus(
        "جاري تجهيز الملصقات..."
      );


      for (
        let i = 0;
        i < files.length;
        i++
      ) {

        const file =
          files[i];


        setStatus(
          `جاري تجهيز الملصق ` +
          `${i + 1} من ${files.length}...`
        );


        const sticker =
          await processSticker(
            file
          );


        /*
          تأكيد إضافي:
          الناتج يجب أن يكون 512×512.
        */

        if (
          sticker.width !== 512 ||
          sticker.height !== 512
        ) {

          throw new Error(
            `الملصق ${i + 1} ليس 512×512`
          );

        }


        /*
          تأكيد الحجم.
        */

        if (
          sticker.size >
          100 * 1024
        ) {

          throw new Error(
            `الملصق ${i + 1} أكبر من 100KB`
          );

        }


        processedStickers.push(
          sticker
        );


        const card =
          createStickerCard(
            sticker,
            i
          );


        preview.appendChild(
          card
        );

      }


      createButton.disabled =
        false;


      setStatus(
        `تم تجهيز ${files.length} ملصقات ✓`
      );


    } catch (error) {

      console.error(
        "Sticker processing error:",
        error
      );


      processedStickers = [];

      currentPack = null;


      createButton.disabled =
        true;

      whatsappButton.disabled =
        true;


      setStatus(
        error.message ||
        "حدث خطأ أثناء معالجة الصور."
      );

    }

  }
);


/* =========================
   CREATE PACK
========================= */

createButton.addEventListener(
  "click",
  async () => {

    if (
      processedStickers.length < 3 ||
      processedStickers.length > 30
    ) {

      setStatus(
        "يجب اختيار من 3 إلى 30 ملصقًا."
      );

      return;
    }


    try {

      createButton.disabled =
        true;

      whatsappButton.disabled =
        true;


      setStatus(
        "جاري إنشاء حزمة WhatsApp..."
      );


      currentPack =
        await createPack(
          packName.value,
          processedStickers
        );


      if (!currentPack) {

        throw new Error(
          "تعذر إنشاء الحزمة."
        );

      }


      /*
        تأكيدات إضافية على الـ Pack.
      */

      if (
        !Array.isArray(
          currentPack.stickers
        )
      ) {

        throw new Error(
          "بيانات الملصقات غير صحيحة."
        );

      }


      if (
        currentPack.stickers.length < 3 ||
        currentPack.stickers.length > 30
      ) {

        throw new Error(
          "عدد الملصقات غير صحيح."
        );

      }


      if (
        !currentPack.identifier ||
        !currentPack.name ||
        !currentPack.publisher ||
        !currentPack.tray_image
      ) {

        throw new Error(
          "بيانات الحزمة ناقصة."
        );

      }


      /*
        الحزمة أصبحت جاهزة
        للـ Native Bridge.
      */

      whatsappButton.disabled =
        false;


      setStatus(
        "تم إنشاء الحزمة بنجاح ✓"
      );


      setBridgeStatus(
        "الحزمة جاهزة للإرسال إلى Native Bridge."
      );


      /*
        مفيد أثناء التطوير.
      */

      console.log(
        "Miku Sticker Pack:",
        currentPack
      );


    } catch (error) {

      console.error(
        "Pack creation error:",
        error
      );


      currentPack =
        null;


      whatsappButton.disabled =
        true;


      setStatus(
        error.message ||
        "تعذر إنشاء الحزمة."
      );


      setBridgeStatus("");

    } finally {

      createButton.disabled =
        false;

    }

  }
);


/* =========================
   SEND TO NATIVE BRIDGE
========================= */

whatsappButton.addEventListener(
  "click",
  async () => {

    if (!currentPack) {

      setStatus(
        "أنشئ الحزمة أولًا."
      );

      return;
    }


    try {

      whatsappButton.disabled =
        true;


      setStatus(
        "جاري إرسال الحزمة..."
      );


      setBridgeStatus(
        "جاري الاتصال بـ Miku Stickers Bridge..."
      );


      const result =
        await sendToWhatsApp(
          currentPack
        );


      /*
        WKWebView Native Bridge
      */

      if (
        result &&
        result.method === "webkit"
      ) {

        setStatus(
          "تم إرسال الحزمة إلى التطبيق ✓"
        );


        setBridgeStatus(
          "تم تسليم الحزمة إلى Native Bridge."
        );


        return;
      }


      /*
        Custom URL Scheme
      */

      if (
        result &&
        result.method === "url"
      ) {

        setStatus(
          "جاري فتح Miku Stickers Bridge..."
        );


        setBridgeStatus(
          "إذا كان التطبيق مثبتًا سيتم استلام الحزمة."
        );


        return;
      }


      /*
        نتيجة غير معروفة.
      */

      setStatus(
        "تم إرسال الطلب."
      );


    } catch (error) {

      console.error(
        "Native Bridge error:",
        error
      );


      setStatus(
        error.message ||
        "تعذر الاتصال بـ Native Bridge."
      );


      setBridgeStatus(
        "لم يتم العثور على Native Bridge."
      );

    } finally {

      /*
        نعطي النظام لحظة قبل
        إعادة تفعيل الزر.
      */

      setTimeout(
        () => {

          whatsappButton.disabled =
            false;

        },
        1500
      );

    }

  }
);


/* =========================
   NATIVE BRIDGE RESULT
========================= */

window.addEventListener(
  "mikuBridgeResult",
  event => {

    const result =
      event.detail;


    if (!result) {
      return;
    }


    if (
      result.success === true
    ) {

      setStatus(
        "تم استيراد الحزمة بنجاح ✓"
      );


      setBridgeStatus(
        "WhatsApp استلم الحزمة."
      );


      return;
    }


    if (
      result.success === false
    ) {

      setStatus(
        result.message ||
        "فشل استيراد الحزمة."
      );


      setBridgeStatus(
        result.error ||
        "حدث خطأ في Native Bridge."
      );

    }

  }
);


/* =========================
   INITIAL STATE
========================= */

setStatus(
  "اختر من 3 إلى 30 صورة."
);

setBridgeStatus(
  "Miku Stickers جاهز."
);
