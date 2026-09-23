"use strict";

/*
=========================================================
 MIKU STICKERS
 Image -> WebP -> .wastickers
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
let generatedStickers = [];
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

function createStickerCanvas(
  img,
  size = STICKER_SIZE
) {
  const canvas =
    document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const ctx =
    canvas.getContext("2d", {
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
   */

  const scale =
    Math.max(
      size / img.width,
      size / img.height
    );

  const width =
    img.width * scale;

  const height =
    img.height * scale;

  const x =
    (size - width) / 2;

  const y =
    (size - height) / 2;

  ctx.drawImage(
    img,
    x,
    y,
    width,
    height
  );

  return canvas;
}

function canvasToRGBA(canvas) {
  const ctx =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  return ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );
}

/* ======================================================
   WEBP
====================================================== */

async function encodeCanvas(
  canvas,
  quality
) {
  const imageData =
    canvasToRGBA(canvas);

  const result =
    await encode(
      imageData,
      {
        quality
      }
    );

  if (!result) {
    throw new Error(
      "تعذر إنشاء WebP."
    );
  }

  const blob =
    new Blob(
      [result],
      {
        type: "image/webp"
      }
    );

  if (
    blob.type !== "image/webp"
  ) {
    throw new Error(
      "تعذر إنشاء ملف WebP."
    );
  }

  return blob;
}

/* ======================================================
   MAKE STICKER
====================================================== */

async function makeSticker(img) {

  /*
   * المطلوب النهائي:
   * 512 × 512
   * WebP
   * أقل من 100KB
   */

  const canvas =
    createStickerCanvas(
      img,
      STICKER_SIZE
    );

  let bestBlob = null;

  let low =
    QUALITY_MIN;

  let high =
    QUALITY_START;

  /*
   * Binary search للجودة
   */

  for (
    let i = 0;
    i < 10;
    i++
  ) {

    const quality =
      Math.floor(
        (low + high) / 2
      );

    const blob =
      await encodeCanvas(
        canvas,
        quality
      );

    if (
      blob.size <= MAX_SIZE
    ) {

      bestBlob = blob;

      low =
        quality + 1;

    } else {

      high =
        quality - 1;
    }
  }

  /*
   * تجربة الجودة الدنيا
   */

  if (!bestBlob) {

    const blob =
      await encodeCanvas(
        canvas,
        QUALITY_MIN
      );

    if (
      blob.size <= MAX_SIZE
    ) {
      bestBlob = blob;
    }
  }

  /*
   * Fallback
   */

  if (!bestBlob) {

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

    for (
      const size of fallbackSizes
    ) {

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

      if (
        blob.size <= MAX_SIZE
      ) {

        /*
         * نرجع نرسمه في 512×512
         * للحفاظ على أبعاد الملصق.
         */

        const finalCanvas =
          document.createElement(
            "canvas"
          );

        finalCanvas.width =
          STICKER_SIZE;

        finalCanvas.height =
          STICKER_SIZE;

        const ctx =
          finalCanvas.getContext(
            "2d"
          );

        ctx.imageSmoothingEnabled =
          true;

        ctx.imageSmoothingQuality =
          "high";

        ctx.drawImage(
          smallCanvas,
          0,
          0,
          STICKER_SIZE,
          STICKER_SIZE
        );

        const finalBlob =
          await encodeCanvas(
            finalCanvas,
            QUALITY_MIN
          );

        if (
          finalBlob.size <= MAX_SIZE
        ) {

          bestBlob =
            finalBlob;

          break;
        }
      }
    }
  }

  if (!bestBlob) {

    throw new Error(
      "تعذر ضغط الصورة تحت 100KB."
    );
  }

  if (
    bestBlob.size > MAX_SIZE
  ) {

    throw new Error(
      `حجم الملصق ${formatBytes(
        bestBlob.size
      )} وهو أكبر من 100KB.`
    );
  }

  return bestBlob;
}

/* ======================================================
   BLOB -> BASE64
====================================================== */

function blobToBase64(blob) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();

      reader.onloadend =
        () => {

          if (
            typeof reader.result !==
            "string"
          ) {

            reject(
              new Error(
                "تعذر قراءة الملف."
              )
            );

            return;
          }

          const parts =
            reader.result.split(",");

          resolve(
            parts[1]
          );
        };

      reader.onerror =
        () => {

          reject(
            new Error(
              "تعذر تحويل الملف."
            )
          );
        };

      reader.readAsDataURL(
        blob
      );
    }
  );
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

    const file =
      selectedFiles[i];

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

    const number =
      document.createElement(
        "div"
      );

    number.className =
      "sticker-number";

    number.textContent =
      `#${i + 1}`;

    const size =
      document.createElement(
        "div"
      );

    size.className =
      "sticker-size";

    size.textContent =
      formatBytes(
        file.size
      );

    const url =
      URL.createObjectURL(
        file
      );

    img.src = url;

    img.onload = () => {
      URL.revokeObjectURL(
        url
      );
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
      Array.from(
        fileInput.files || []
      );

    if (
      files.length <
        MIN_STICKERS ||
      files.length >
        MAX_STICKERS
    ) {

      selectedFiles = [];
      generatedStickers = [];
      generatedPack = null;

      preview.innerHTML =
        "";

      createButton.disabled =
        true;

      whatsappButton.disabled =
        true;

      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} صورة.`
      );

      return;
    }

    selectedFiles =
      files;

    generatedStickers =
      [];

    generatedPack =
      null;

    whatsappButton.disabled =
      true;

    bridgeStatus.textContent =
      "Miku Stickers جاهز.";

    await renderPreview();

    createButton.disabled =
      false;

    setStatus(
      `تم اختيار ${files.length} صورة.`
    );
  }
);

/* ======================================================
   CREATE STICKERS
====================================================== */

createButton.addEventListener(
  "click",
  async () => {

    if (
      selectedFiles.length <
        MIN_STICKERS ||
      selectedFiles.length >
        MAX_STICKERS
    ) {

      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} صورة.`
      );

      return;
    }

    createButton.disabled =
      true;

    whatsappButton.disabled =
      true;

    generatedStickers =
      [];

    generatedPack =
      null;

    try {

      for (
        let i = 0;
        i < selectedFiles.length;
        i++
      ) {

        setStatus(
          `جاري تحويل الملصق ${i + 1} من ${selectedFiles.length}...`
        );

        const img =
          await loadImage(
            selectedFiles[i]
          );

        const blob =
          await makeSticker(
            img
          );

        if (
          blob.size > MAX_SIZE
        ) {

          throw new Error(
            `الملصق ${i + 1} أكبر من 100KB.`
          );
        }

        generatedStickers.push(
          {
            index: i,
            blob
          }
        );

        /*
         * تحديث المعاينة
         */

        const cards =
          preview.querySelectorAll(
            ".sticker-card"
          );

        if (cards[i]) {

          const image =
            cards[i].querySelector(
              "img"
            );

          const size =
            cards[i].querySelector(
              ".sticker-size"
            );

          if (image) {

            const url =
              URL.createObjectURL(
                blob
              );

            image.src =
              url;
          }

          if (size) {

            size.textContent =
              formatBytes(
                blob.size
              );
          }
        }
      }

      setStatus(
        "جاري تجهيز الحزمة..."
      );

      generatedPack =
        await buildPack();

      whatsappButton.disabled =
        false;

      bridgeStatus.textContent =
        "الحزمة جاهزة للتصدير.";

      setStatus(
        `تم تجهيز ${generatedStickers.length} ملصق بنجاح.`
      );

    } catch (error) {

      console.error(error);

      generatedStickers =
        [];

      generatedPack =
        null;

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
   CREATE COVER
====================================================== */

async function createCoverBlob() {

  const img =
    await loadImage(
      selectedFiles[0]
    );

  const canvas =
    document.createElement(
      "canvas"
    );

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

  return new Promise(
    (resolve, reject) => {

      canvas.toBlob(
        blob => {

          if (!blob) {

            reject(
              new Error(
                "تعذر إنشاء الغلاف."
              )
            );

            return;
          }

          resolve(blob);
        },
        "image/png"
      );
    }
  );
}

/* ======================================================
   BUILD PACK DATA
====================================================== */

async function buildPack() {

  const name =
    packNameInput.value.trim() ||
    "Miku Stickers";

  const cover =
    await createCoverBlob();

  const identifier =
    "com.miku.stickers." +
    Date.now();

  return {
    identifier,
    name,
    publisher:
      "Miku Stickers",
    cover,
    stickers:
      generatedStickers
  };
}

/* ======================================================
   CREATE .WASTICKERS
====================================================== */

async function createWastickersFile() {

  if (
    !generatedPack ||
    !generatedStickers.length
  ) {

    throw new Error(
      "أنشئ الحزمة أولًا."
    );
  }

  /*
   * التأكد من وجود JSZip
   */

  if (
    typeof JSZip ===
    "undefined"
  ) {

    throw new Error(
      "مكتبة ZIP غير محملة. تأكد من إضافة JSZip في index.html."
    );
  }

  const zip =
    new JSZip();

  const packFolder =
    zip.folder(
      "Miku Stickers"
    );

  /*
   * إضافة الملصقات
   */

  for (
    const sticker
    of generatedStickers
  ) {

    packFolder.file(
      `${sticker.index}.webp`,
      sticker.blob
    );
  }

  /*
   * الغلاف
   */

  packFolder.file(
    "cover.png",
    generatedPack.cover
  );

  /*
   * اسم الحزمة
   */

  packFolder.file(
    "title.txt",
    generatedPack.name
  );

  /*
   * الناشر
   */

  packFolder.file(
    "author.txt",
    generatedPack.publisher
  );

  /*
   * معلومات إضافية
   */

  const metadata = {
    identifier:
      generatedPack.identifier,

    name:
      generatedPack.name,

    publisher:
      generatedPack.publisher,

    stickerCount:
      generatedStickers.length,

    stickerSize:
      "512x512",

    format:
      "WebP",

    maxStickerSize:
      "100KB"
  };

  packFolder.file(
    "pack.json",
    JSON.stringify(
      metadata,
      null,
      2
    )
  );

  /*
   * إنشاء ZIP
   */

  const blob =
    await zip.generateAsync(
      {
        type: "blob",
        compression:
          "DEFLATE",
        compressionOptions:
          {
            level: 6
          }
      }
    );

  return blob;
}

/* ======================================================
   DOWNLOAD .WASTICKERS
====================================================== */

function downloadWastickers(
  blob
) {

  const packName =
    generatedPack?.name ||
    "Miku Stickers";

  const safeName =
    packName
      .replace(
        /[\\/:*?"<>|]/g,
        ""
      )
      .trim() ||
    "Miku Stickers";

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download =
    `${safeName}.wastickers`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      );
    },
    2000
  );
}

/* ======================================================
   WHATSAPP BUTTON
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

    whatsappButton.disabled =
      true;

    try {

      setStatus(
        "جاري إنشاء حزمة WhatsApp..."
      );

      bridgeStatus.textContent =
        "جاري ضغط ملفات الحزمة...";

      const wastickers =
        await createWastickersFile();

      downloadWastickers(
        wastickers
      );

      bridgeStatus.textContent =
        "تم إنشاء حزمة .wastickers بنجاح.";

      setStatus(
        "تم تصدير حزمة الملصقات."
      );

    } catch (error) {

      console.error(error);

      bridgeStatus.textContent =
        "تعذر إنشاء الحزمة.";

      setStatus(
        error?.message ||
        "حدث خطأ أثناء إنشاء الحزمة."
      );

    } finally {

      whatsappButton.disabled =
        false;
    }
  }
);

/* ======================================================
   INITIAL STATE
====================================================== */

createButton.disabled =
  true;

whatsappButton.disabled =
  true;

bridgeStatus.textContent =
  "Miku Stickers جاهز.";

setStatus(
  `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} صورة.`
);
