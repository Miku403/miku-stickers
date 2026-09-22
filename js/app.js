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


/* =========================
   Elements
========================= */

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


/* =========================
   State
========================= */

let processedStickers = [];

let currentPack = null;


/* =========================
   Status
========================= */

function setStatus(message) {

  if (!status) {
    return;
  }

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
   Reset
========================= */

function resetProject() {

  processedStickers = [];

  currentPack = null;

  preview.innerHTML = "";

  createButton.disabled = true;

  whatsappButton.disabled = true;

  setBridgeStatus("");
}


/* =========================
   Preview Card
========================= */

function createStickerCard(
  sticker,
  index
) {

  const card =
    document.createElement("div");

  card.className =
    "sticker-card";


  const img =
    document.createElement("img");


  const imageUrl =
    URL.createObjectURL(
      sticker.blob
    );


  img.src =
    imageUrl;


  img.alt =
    `Sticker ${index + 1}`;


  img.onload = () => {

    /*
      لا نحذف الـ URL مباشرة
      حتى تبقى الصورة ظاهرة.
    */

  };


  const number =
    document.createElement("div");

  number.className =
    "sticker-number";

  number.textContent =
    `#${index + 1}`;


  const size =
    document.createElement("div");

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
   File Input
========================= */

fileInput.addEventListener(
  "change",
  async () => {

    resetProject();


    const files =
      Array.from(
        fileInput.files || []
      );


    console.log(
      "Selected files:",
      files
    );


    /* =====================
       Validate Count
    ===================== */

    if (
      files.length < 3 ||
      files.length > 30
    ) {

      setStatus(
        `تم اختيار ${files.length} صورة. ` +
        `اختر من 3 إلى 30 صورة.`
      );

      return;
    }


    try {

      setStatus(
        `تم اختيار ${files.length} صورة، ` +
        `جاري تجهيزها...`
      );


      /* ===================
         Process Images
      =================== */

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


        console.log(
          `Processing ${i + 1}:`,
          file.name
        );


        const sticker =
          await processSticker(
            file
          );


        /* =================
           Validate Sticker
        ================= */

        if (
          sticker.width !== 512 ||
          sticker.height !== 512
        ) {

          throw new Error(
            `الملصق ${i + 1} ليس 512×512`
          );

        }


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


        /* =================
           Show Preview
        ================= */

        const card =
          createStickerCard(
            sticker,
            i
          );


        preview.appendChild(
          card
        );


        console.log(
          `Sticker ${i + 1} ready`
        );

      }


      /* =====================
         Finished
      ===================== */

      createButton.disabled =
        false;


      setStatus(
        `تم تجهيز ${files.length} ملصقات ✓`
      );


      console.log(
        "All stickers ready:",
        processedStickers
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
   Create WhatsApp Pack
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


      whatsappButton.disabled =
        false;


      setStatus(
        "تم إنشاء الحزمة بنجاح ✓"
      );


      setBridgeStatus(
        "الحزمة جاهزة للإرسال إلى Native Bridge."
      );


      console.log(
        "Miku Sticker Pack:",
        currentPack
      );

    } catch (error) {

      console.error(
        "Pack creation error:",
        error
      );


      currentPack = null;


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
   Send To WhatsApp
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
   Native Bridge Result
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
   Initial State
========================= */

setStatus(
  "اختر من 3 إلى 30 صورة."
);


setBridgeStatus(
  "Miku Stickers جاهز."
);
