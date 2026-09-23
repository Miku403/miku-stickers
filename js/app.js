"use strict";

/*
=========================================================
 MIKU STICKERS
 Image -> 512x512 WebP -> WhatsApp Sticker Pack
=========================================================
*/

import { encode } from "https://cdn.jsdelivr.net/npm/@jsquash/webp@1.5.0/+esm";

/* ======================================================
   DOM
====================================================== */

const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const createButton = document.getElementById("createButton");
const whatsappButton = document.getElementById("whatsappButton");
const bridgeStatus = document.getElementById("bridgeStatus");
const packNameInput = document.getElementById("packName");

/* ======================================================
   SETTINGS
====================================================== */

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;

const STICKER_SIZE = 512;
const MAX_SIZE = 100 * 1024;

const QUALITY_START = 90;
const QUALITY_MIN = 1;

/* ======================================================
   STATE
====================================================== */

let selectedFiles = [];
let generatedPack = null;

/* ======================================================
   HELPERS
====================================================== */

function setStatus(message) {
  status.textContent = message;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);

    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذر فتح الصورة."));
    };

    img.src = url;
  });
}

/* ======================================================
   CANVAS
====================================================== */

function canvasToRGBA(canvas) {
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  return ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );
}

/* ======================================================
   WEBP ENCODER
====================================================== */

async function encodeWebP(imageData, quality) {

  const result = await encode(
    imageData,
    {
      quality
    }
  );

  return new Blob(
    [result],
    {
      type: "image/webp"
    }
  );
}

/* ======================================================
   CREATE 512x512 CANVAS
====================================================== */

function createStickerCanvas(img, size = STICKER_SIZE) {

  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d", {
    alpha: true
  });

  ctx.clearRect(
    0,
    0,
    size,
    size
  );

  /*
   * Cover crop
   * يحافظ على ملء المربع بدون تشويه الصورة
   */

  const scale = Math.max(
    size / img.width,
    size / img.height
  );

  const width = img.width * scale;
  const height = img.height * scale;

  const x = (size - width) / 2;
  const y = (size - height) / 2;

  ctx.drawImage(
    img,
    x,
    y,
    width,
    height
  );

  return canvas;
}

/* ======================================================
   UPSCALE
====================================================== */

function upscaleTo512(canvas) {

  if (
    canvas.width === STICKER_SIZE &&
    canvas.height === STICKER_SIZE
  ) {
    return canvas;
  }

  const result = document.createElement("canvas");

  result.width = STICKER_SIZE;
  result.height = STICKER_SIZE;

  const ctx = result.getContext("2d");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    canvas,
    0,
    0,
    STICKER_SIZE,
    STICKER_SIZE
  );

  return result;
}

/* ======================================================
   ENCODE CANVAS
====================================================== */

async function encodeCanvas(canvas, quality) {

  const rgba = canvasToRGBA(canvas);

  const blob = await encodeWebP(
    rgba,
    quality
  );

  if (!blob) {
    throw new Error(
      "تعذر إنشاء WebP."
    );
  }

  if (blob.type !== "image/webp") {
    throw new Error(
      `المتصفح لم ينشئ WebP. الصيغة الناتجة: ${blob.type}`
    );
  }

  return blob;
}

/* ======================================================
   MAKE STICKER
====================================================== */

async function makeSticker(img) {

  /*
   * نحاول دائمًا إنتاج ملصق نهائي 512x512.
   *
   * إذا كان حجم WebP أكبر من 100KB:
   * نقلل الجودة تدريجيًا.
   */

  const canvas = createStickerCanvas(
    img,
    STICKER_SIZE
  );

  let bestBlob = null;

  /*
   * Binary search للجودة
   */

  let low = QUALITY_MIN;
  let high = QUALITY_START;

  for (let i = 0; i < 10; i++) {

    const quality = Math.floor(
      (low + high) / 2
    );

    const blob = await encodeCanvas(
      canvas,
      quality
    );

    if (blob.size <= MAX_SIZE) {

      bestBlob = blob;

      /*
       * نجرب جودة أعلى
       */

      low = quality + 1;

    } else {

      /*
       * نحتاج جودة أقل
       */

      high = quality - 1;
    }
  }

  /*
   * تأكد من تجربة أقل جودة مسموحة
   */

  if (!bestBlob) {

    const minimumBlob =
      await encodeCanvas(
        canvas,
        QUALITY_MIN
      );

    if (minimumBlob.size <= MAX_SIZE) {

      bestBlob = minimumBlob;

    } else {

      /*
       * إذا حتى الجودة 1 أكبر من 100KB،
       * نستخدم تصغير داخلي ثم نعيد تكبير الناتج
       * إلى 512x512.
       */

      const fallbackSizes = [
        448,
        384,
        320,
        256,
        224,
        192,
        160,
        128,
        96
      ];

      for (const size of fallbackSizes) {

        const smallCanvas =
          createStickerCanvas(
            img,
            size
          );

        const blob =
          await encodeCanvas(
            smallCanvas,
            QUALITY_MIN
          );

        if (blob.size <= MAX_SIZE) {

          bestBlob = blob;

          break;
        }
      }
    }
  }

  if (!bestBlob) {

    throw new Error(
      `تعذر ضغط الملصق تحت 100KB. الحجم النهائي تجاوز الحد.`
    );
  }

  /*
   * نضمن أن النتيجة WebP
   */

  if (bestBlob.type !== "image/webp") {

    throw new Error(
      `الناتج ليس WebP: ${bestBlob.type}`
    );
  }

  return bestBlob;
}

/* ======================================================
   PREVIEW
====================================================== */

async function renderPreview() {

  preview.innerHTML = "";

  for (
    let i = 0;
    i < selectedFiles.length;
    i++
  ) {

    const file = selectedFiles[i];

    const card =
      document.createElement("div");

    card.className =
      "sticker-card";

    const img =
      document.createElement("img");

    const number =
      document.createElement("div");

    number.className =
      "sticker-number";

    number.textContent =
      `#${i + 1}`;

    const size =
      document.createElement("div");

    size.className =
      "sticker-size";

    size.textContent =
      formatBytes(file.size);

    img.src =
      URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(img.src);
    };

    card.appendChild(img);
    card.appendChild(number);
    card.appendChild(size);

    preview.appendChild(card);
  }
}

/* ======================================================
   FILE INPUT
====================================================== */

fileInput.addEventListener(
  "change",
  async () => {

    const files =
      Array.from(fileInput.files || []);

    if (
      files.length < MIN_STICKERS ||
      files.length > MAX_STICKERS
    ) {

      selectedFiles = [];

      preview.innerHTML = "";

      createButton.disabled = true;
      whatsappButton.disabled = true;

      generatedPack = null;

      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} صورة.`
      );

      return;
    }

    selectedFiles = files;

    generatedPack = null;

    whatsappButton.disabled = true;

    bridgeStatus.textContent =
      "Miku Stickers جاهز.";

    await renderPreview();

    createButton.disabled = false;

    setStatus(
      `تم اختيار ${selectedFiles.length} صورة.`
    );
  }
);

/* ======================================================
   CREATE PACK
====================================================== */

createButton.addEventListener(
  "click",
  async () => {

    if (
      selectedFiles.length < MIN_STICKERS ||
      selectedFiles.length > MAX_STICKERS
    ) {
      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} صورة.`
      );

      return;
    }

    createButton.disabled = true;
    whatsappButton.disabled = true;

    generatedPack = null;

    try {

      const stickers = [];

      for (
        let i = 0;
        i < selectedFiles.length;
        i++
      ) {

        setStatus(
          `جاري تحويل الملصق ${i + 1} من ${selectedFiles.length}...`
        );

        const file =
          selectedFiles[i];

        const img =
          await loadImage(file);

        const blob =
          await makeSticker(img);

        /*
         * تأكيد الحجم
         */

        if (blob.size > MAX_SIZE) {

          throw new Error(
            `الملصق ${i + 1} أكبر من 100KB: ${formatBytes(blob.size)}`
          );
        }

        /*
         * تأكيد WebP
         */

        if (
          blob.type !== "image/webp"
        ) {

          throw new Error(
            `الملصق ${i + 1} ليس WebP. الناتج: ${blob.type}`
          );
        }

        /*
         * معاينة الناتج الحقيقي
         */

        const stickerURL =
          URL.createObjectURL(blob);

        const cards =
          preview.querySelectorAll(
            ".sticker-card"
          );

        if (cards[i]) {

          const previewImage =
            cards[i].querySelector("img");

          if (previewImage) {

            previewImage.src =
              stickerURL;
          }

          const sizeElement =
            cards[i].querySelector(
              ".sticker-size"
            );

          if (sizeElement) {

            sizeElement.textContent =
              formatBytes(blob.size);
          }
        }

        const base64 =
          await blobToBase64(blob);

        stickers.push({
          file: `${i}.webp`,
          data: base64
        });
      }

      setStatus(
        "جاري إنشاء الحزمة..."
      );

      const pack =
        await buildPack(
          stickers
        );

      generatedPack =
        pack;

      whatsappButton.disabled =
        false;

      bridgeStatus.textContent =
        "تم تجهيز الحزمة بنجاح.";

      setStatus(
        `تم إنشاء حزمة تحتوي على ${stickers.length} ملصق.`
      );

    } catch (error) {

      console.error(error);

      generatedPack = null;

      whatsappButton.disabled =
        true;

      bridgeStatus.textContent =
        "حدث خطأ أثناء إنشاء الحزمة.";

      setStatus(
        error?.message ||
        "حدث خطأ غير معروف."
      );

    } finally {

      createButton.disabled =
        false;
    }
  }
);

/* ======================================================
   BLOB -> BASE64
====================================================== */

function blobToBase64(blob) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();

      reader.onloadend = () => {

        const result =
          reader.result;

        if (
          typeof result !== "string"
        ) {
          reject(
            new Error(
              "تعذر قراءة الملف."
            )
          );

          return;
        }

        const base64 =
          result.split(",")[1];

        resolve(base64);
      };

      reader.onerror = () => {

        reject(
          new Error(
            "تعذر تحويل الملصق."
          )
        );
      };

      reader.readAsDataURL(blob);
    }
  );
}

/* ======================================================
   CREATE COVER
====================================================== */

async function createCover() {

  const firstFile =
    selectedFiles[0];

  const img =
    await loadImage(firstFile);

  const canvas =
    document.createElement("canvas");

  canvas.width = 96;
  canvas.height = 96;

  const ctx =
    canvas.getContext("2d");

  const scale =
    Math.max(
      96 / img.width,
      96 / img.height
    );

  const width =
    img.width * scale;

  const height =
    img.height * scale;

  const x =
    (96 - width) / 2;

  const y =
    (96 - height) / 2;

  ctx.drawImage(
    img,
    x,
    y,
    width,
    height
  );

  const blob =
    await new Promise(
      resolve =>
        canvas.toBlob(
          resolve,
          "image/png"
        )
    );

  if (!blob) {

    throw new Error(
      "تعذر إنشاء صورة الغلاف."
    );
  }

  return blobToBase64(blob);
}

/* ======================================================
   BUILD PACK
====================================================== */

async function buildPack(
  stickers
) {

  const name =
    packNameInput.value.trim() ||
    "Miku Stickers";

  const trayImage =
    await createCover();

  return {

    identifier:
      "com.miku.stickers." +
      Date.now(),

    name,

    publisher:
      "Miku Stickers",

    tray_image:
      trayImage,

    stickers:
      stickers.map(
        (sticker, index) => ({
          file:
            `${index}.webp`,

          data:
            sticker.data
        })
      )
  };
}

/* ======================================================
   WHATSAPP
====================================================== */

whatsappButton.addEventListener(
  "click",
  async () => {

    if (!generatedPack) {

      setStatus(
        "أنشئ الحزمة أولًا."
      );

      return;
    }

    /*
     * مهم:
     * صفحة الويب العادية لا تستطيع تنفيذ
     * UIPasteboard الخاص بواتساب مباشرة.
     *
     * لذلك لا ندّعي أن الزر يضيف الحزمة
     * مباشرة إلى WhatsApp من Safari.
     */

    bridgeStatus.textContent =
      "الحزمة جاهزة، لكن الإضافة المباشرة إلى WhatsApp على iPhone تحتاج تطبيقًا أصليًا.";

    setStatus(
      "تم تجهيز حزمة WhatsApp بنجاح."
    );
  }
);

/* ======================================================
   INITIAL STATE
====================================================== */

createButton.disabled = true;
whatsappButton.disabled = true;

bridgeStatus.textContent =
  "Miku Stickers جاهز.";

setStatus(
  `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} صورة.`
);
