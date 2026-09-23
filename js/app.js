"use strict";

/* =========================================
   MIKU STICKERS
   PNG / JPG / WEBP / GIF
   3 - 30 files
========================================= */

import { encode as encodeWebP } from
  "https://esm.sh/@jsquash/webp@1.5.0";


/* =========================================
   ELEMENTS
========================================= */

const fileInput =
  document.getElementById("fileInput");

const preview =
  document.getElementById("preview");

const status =
  document.getElementById("status");

const createButton =
  document.getElementById("createButton");

const whatsappButton =
  document.getElementById("whatsappButton");

const bridgeStatus =
  document.getElementById("bridgeStatus");


/* =========================================
   SETTINGS
========================================= */

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;

const MAX_STATIC_SIZE =
  100 * 1024;

let selectedFiles = [];
let generatedFiles = [];


/* =========================================
   STATUS
========================================= */

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}

function setBridgeStatus(message) {
  if (bridgeStatus) {
    bridgeStatus.textContent = message;
  }
}


/* =========================================
   FILE SIZE
========================================= */

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(2)} MB`;
}


/* =========================================
   FILE TYPES
========================================= */

function isGIF(file) {
  return (
    file.type === "image/gif" ||
    /\.gif$/i.test(file.name)
  );
}

function isStaticImage(file) {
  return (
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/webp" ||
    /\.(png|jpe?g|webp)$/i.test(
      file.name
    )
  );
}

function isSupported(file) {
  return (
    isGIF(file) ||
    isStaticImage(file)
  );
}


/* =========================================
   OBJECT URL
========================================= */

function revokeURL(url) {
  try {
    URL.revokeObjectURL(url);
  } catch (_) {}
}


/* =========================================
   PREVIEW
========================================= */

function renderPreview(files) {
  preview.innerHTML = "";

  files.forEach((file, index) => {
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
      `#${index + 1}`;

    const size =
      document.createElement("div");

    size.className =
      "sticker-size";

    size.textContent =
      formatBytes(file.size);

    const type =
      document.createElement("div");

    type.className =
      "sticker-type";

    type.textContent =
      isGIF(file)
        ? "GIF متحرك"
        : "صورة";

    const url =
      URL.createObjectURL(file);

    img.src = url;
    img.alt =
      `ملصق ${index + 1}`;

    img.onload = () => {
      /*
       * GIF يحتاج أن يبقى Object URL
       * متاحًا أثناء المعاينة.
       */
      if (!isGIF(file)) {
        revokeURL(url);
      }
    };

    img.onerror = () => {
      revokeURL(url);

      console.error(
        "تعذر عرض الملف:",
        file.name
      );
    };

    card.appendChild(img);
    card.appendChild(number);
    card.appendChild(size);
    card.appendChild(type);

    preview.appendChild(card);
  });
}


/* =========================================
   FILE SELECTION
========================================= */

fileInput.addEventListener(
  "change",
  () => {
    const files =
      Array.from(
        fileInput.files || []
      );

    selectedFiles = [];
    generatedFiles = [];

    whatsappButton.disabled =
      true;

    if (!files.length) {
      preview.innerHTML = "";

      createButton.disabled =
        true;

      setStatus(
        "لم يتم اختيار أي ملف."
      );

      setBridgeStatus(
        "Miku Stickers جاهز."
      );

      return;
    }

    if (
      files.length <
        MIN_STICKERS ||
      files.length >
        MAX_STICKERS
    ) {
      preview.innerHTML = "";

      createButton.disabled =
        true;

      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف. تم اختيار ${files.length}.`
      );

      setBridgeStatus(
        "عدد الملفات غير صحيح."
      );

      return;
    }

    const unsupported =
      files.filter(
        file =>
          !isSupported(file)
      );

    if (unsupported.length) {
      preview.innerHTML = "";

      createButton.disabled =
        true;

      setStatus(
        "يوجد ملف غير مدعوم. استخدم PNG أو JPG أو WEBP أو GIF فقط."
      );

      setBridgeStatus(
        `الملف غير المدعوم: ${unsupported[0].name}`
      );

      return;
    }

    selectedFiles = files;

    renderPreview(
      selectedFiles
    );

    createButton.disabled =
      false;

    const gifCount =
      files.filter(isGIF).length;

    const imageCount =
      files.length - gifCount;

    if (
      gifCount > 0 &&
      imageCount > 0
    ) {
      setStatus(
        `تم اختيار ${files.length} ملف: ${imageCount} صورة و${gifCount} GIF.`
      );

      setBridgeStatus(
        "تم تحميل الصور وGIF معًا بنجاح."
      );

    } else if (
      gifCount > 0
    ) {
      setStatus(
        `تم اختيار ${gifCount} GIF بنجاح.`
      );

      setBridgeStatus(
        "تم تحميل ملفات GIF."
      );

    } else {
      setStatus(
        `تم اختيار ${imageCount} صورة بنجاح.`
      );

      setBridgeStatus(
        "تم تحميل الصور."
      );
    }
  }
);


/* =========================================
   LOAD IMAGE
========================================= */

function loadImage(file) {
  return new Promise(
    (resolve, reject) => {
      const img =
        new Image();

      const url =
        URL.createObjectURL(file);

      img.onload = () => {
        revokeURL(url);
        resolve(img);
      };

      img.onerror = () => {
        revokeURL(url);

        reject(
          new Error(
            `تعذر قراءة الصورة: ${file.name}`
          )
        );
      };

      img.src = url;
    }
  );
}


/* =========================================
   CREATE 512×512 IMAGE DATA
========================================= */

async function imageToImageData(
  file,
  contentScale = 1
) {
  const img =
    await loadImage(file);

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = 512;
  canvas.height = 512;

  const ctx =
    canvas.getContext(
      "2d",
      {
        alpha: true
      }
    );

  if (!ctx) {
    throw new Error(
      "تعذر إنشاء Canvas."
    );
  }

  ctx.clearRect(
    0,
    0,
    512,
    512
  );

  /*
   * نحافظ على نسبة أبعاد
   * الصورة الأصلية.
   */

  const baseScale =
    Math.min(
      512 / img.width,
      512 / img.height
    );

  const width =
    Math.round(
      img.width *
      baseScale *
      contentScale
    );

  const height =
    Math.round(
      img.height *
      baseScale *
      contentScale
    );

  const x =
    Math.round(
      (512 - width) / 2
    );

  const y =
    Math.round(
      (512 - height) / 2
    );

  ctx.drawImage(
    img,
    x,
    y,
    width,
    height
  );

  return ctx.getImageData(
    0,
    0,
    512,
    512
  );
}


/* =========================================
   ENCODE WEBP WITH JSQUASH
========================================= */

async function encodeImageData(
  imageData,
  quality
) {
  const buffer =
    await encodeWebP(
      imageData,
      {
        quality: quality,
        method: 4
      }
    );

  if (
    !(buffer instanceof ArrayBuffer)
  ) {
    throw new Error(
      "لم ترجع مكتبة WebP ملفًا صالحًا."
    );
  }

  if (
    buffer.byteLength === 0
  ) {
    throw new Error(
      "ملف WebP الناتج فارغ."
    );
  }

  return new Blob(
    [buffer],
    {
      type: "image/webp"
    }
  );
}


/* =========================================
   SMART WEBP COMPRESSION
========================================= */

async function createStaticSticker(
  file
) {
  let quality = 80;

  let contentScale = 1;

  /*
   * نحاول عدة مستويات.
   *
   * الـCanvas النهائي دائمًا 512×512.
   */

  for (
    let attempt = 0;
    attempt < 30;
    attempt++
  ) {
    setStatus(
      `جاري ضغط ${file.name}...`
    );

    const imageData =
      await imageToImageData(
        file,
        contentScale
      );

    const blob =
      await encodeImageData(
        imageData,
        quality
      );

    /*
     * نجاح
     */

    if (
      blob.size <=
      MAX_STATIC_SIZE
    ) {
      return new File(
        [blob],
        `sticker-${Date.now()}-${attempt}.webp`,
        {
          type: "image/webp"
        }
      );
    }

    /*
     * نقلل الجودة أولًا.
     */

    if (
      quality > 30
    ) {
      quality -= 10;

      continue;
    }

    /*
     * إذا وصلنا لجودة منخفضة جدًا،
     * نصغر محتوى الصورة داخل 512×512.
     */

    if (
      contentScale > 0.45
    ) {
      contentScale -= 0.10;

      quality = 50;

      continue;
    }

    break;
  }

  throw new Error(
    `${file.name} ما قدرنا نضغطه إلى أقل من 100KB.`
  );
}


/* =========================================
   GIF VALIDATION
========================================= */

async function prepareGIF(file) {
  const buffer =
    await file.arrayBuffer();

  if (
    !buffer ||
    buffer.byteLength === 0
  ) {
    throw new Error(
      `ملف GIF فارغ أو تالف: ${file.name}`
    );
  }

  const headerBytes =
    new Uint8Array(
      buffer.slice(0, 6)
    );

  const header =
    String.fromCharCode(
      ...headerBytes
    );

  if (
    header !== "GIF87a" &&
    header !== "GIF89a"
  ) {
    throw new Error(
      `${file.name} ليس GIF صالحًا.`
    );
  }

  return file;
}


/* =========================================
   COVER
========================================= */

async function createCover(file) {
  const imageData =
    await imageToImageData(
      file,
      1
    );

  /*
   * للـCover نستخدم أول إطار
   * من GIF إذا كان GIF مدعومًا
   * بواسطة المتصفح.
   */

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = 96;
  canvas.height = 96;

  const ctx =
    canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "تعذر إنشاء الغلاف."
    );
  }

  /*
   * ImageData = 512×512
   */

  const temp =
    document.createElement(
      "canvas"
    );

  temp.width = 512;
  temp.height = 512;

  const tempCtx =
    temp.getContext("2d");

  tempCtx.putImageData(
    imageData,
    0,
    0
  );

  ctx.drawImage(
    temp,
    0,
    0,
    96,
    96
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

          resolve(
            new File(
              [blob],
              "cover.png",
              {
                type:
                  "image/png"
              }
            )
          );
        },
        "image/png"
      );
    }
  );
}


/* =========================================
   CREATE PACK
========================================= */

async function createStickerPack() {
  if (
    selectedFiles.length <
      MIN_STICKERS ||
    selectedFiles.length >
      MAX_STICKERS
  ) {
    throw new Error(
      `يجب اختيار من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف.`
    );
  }

  const packNameInput =
    document.getElementById(
      "packName"
    );

  const packName =
    packNameInput?.value.trim() ||
    "Miku Stickers";

  const outputFiles = [];

  let coverFile = null;

  for (
    let i = 0;
    i < selectedFiles.length;
    i++
  ) {
    const file =
      selectedFiles[i];

    setStatus(
      `جاري تجهيز الملصق ${i + 1} من ${selectedFiles.length}...`
    );

    if (isGIF(file)) {

      /*
       * GIF حاليًا يتم التحقق منه
       * والاحتفاظ به كما هو.
       *
       * تحويله إلى Animated WebP
       * يحتاج مسار Encoder متحرك مستقل.
       */

      await prepareGIF(file);

      outputFiles.push({
        original: file,
        output: file,
        animated: true
      });

    } else {

      const webpFile =
        await createStaticSticker(
          file
        );

      outputFiles.push({
        original: file,
        output: webpFile,
        animated: false
      });
    }

    /*
     * أول ملف = Cover
     */

    if (i === 0) {
      /*
       * الغلاف للصور الثابتة.
       * إذا كان أول عنصر GIF،
       * نحاول أخذ أول صورة منه.
       */

      if (isGIF(file)) {
        coverFile = null;
      } else {
        coverFile =
          await createCover(
            file
          );
      }
    }
  }

  return {
    packName,
    files: outputFiles,
    cover: coverFile
  };
}


/* =========================================
   CREATE BUTTON
========================================= */

createButton.addEventListener(
  "click",
  async () => {

    if (
      selectedFiles.length <
      MIN_STICKERS
    ) {
      setStatus(
        `اختر ${MIN_STICKERS} ملفات على الأقل.`
      );

      return;
    }

    createButton.disabled =
      true;

    whatsappButton.disabled =
      true;

    try {

      setBridgeStatus(
        "جاري تحويل الصور إلى WebP..."
      );

      const result =
        await createStickerPack();

      generatedFiles =
        result.files;

      const staticCount =
        generatedFiles.filter(
          item =>
            !item.animated
        ).length;

      const gifCount =
        generatedFiles.filter(
          item =>
            item.animated
        ).length;

      setStatus(
        `تم تجهيز ${generatedFiles.length} ملف: ${staticCount} صورة و${gifCount} GIF.`
      );

      setBridgeStatus(
        `الحزمة "${result.packName}" جاهزة.`
      );

      whatsappButton.disabled =
        false;

    } catch (error) {

      console.error(
        "Miku Stickers Error:",
        error
      );

      setStatus(
        error?.message ||
        "حدث خطأ أثناء إنشاء الحزمة."
      );

      setBridgeStatus(
        "تعذر إنشاء الحزمة."
      );

    } finally {

      createButton.disabled =
        false;
    }
  }
);


/* =========================================
   SHARE
========================================= */

whatsappButton.addEventListener(
  "click",
  async () => {

    if (
      !generatedFiles.length
    ) {
      setStatus(
        "أنشئ الحزمة أولًا."
      );

      return;
    }

    try {

      const files =
        generatedFiles.map(
          item =>
            item.output
        );

      if (
        navigator.share &&
        navigator.canShare
      ) {

        if (
          navigator.canShare({
            files
          })
        ) {

          await navigator.share({
            files,
            title:
              "Miku Stickers",
            text:
              "ملصقات Miku"
          });

          setStatus(
            "تم فتح قائمة المشاركة."
          );

          setBridgeStatus(
            "اختر Sticker Maker من قائمة المشاركة."
          );

          return;
        }
      }

      setStatus(
        "المتصفح لا يدعم مشاركة الملفات مباشرة."
      );

      setBridgeStatus(
        "جرّب Safari."
      );

    } catch (error) {

      if (
        error?.name ===
        "AbortError"
      ) {
        setStatus(
          "تم إلغاء المشاركة."
        );

        return;
      }

      console.error(
        "Share Error:",
        error
      );

      setStatus(
        "تعذر فتح قائمة المشاركة."
      );
    }
  }
);


/* =========================================
   INITIAL STATE
========================================= */

createButton.disabled =
  true;

whatsappButton.disabled =
  true;

setStatus(
  `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} صورة أو GIF.`
);

setBridgeStatus(
  "Miku Stickers جاهز."
);
