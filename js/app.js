"use strict";

/*
=========================================================
 MIKU STICKERS
 JPG / PNG / WEBP / GIF
        ↓
512 × 512
        ↓
WebP / Animated WebP
        ↓
Compression
        ↓
.wastickers
        ↓
Share → Sticker Maker / WhatsApp-compatible app
=========================================================
*/

import {
  encodeRGBA,
  encodeAnimation
} from "https://esm.sh/wasm-webp@0.1.0";

import {
  parseGIF,
  decompressFrames
} from "https://esm.sh/gifuct-js@2.1.2";

/* ======================================================
   DOM
====================================================== */

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

const packNameInput =
  document.getElementById("packName");

/* ======================================================
   SETTINGS
====================================================== */

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;

const SIZE = 512;

const STATIC_MAX =
  100 * 1024;

const ANIMATED_MAX =
  500 * 1024;

const COVER_SIZE = 96;

const MAX_ANIMATION_MS =
  10 * 1000;

const MIN_FRAME_MS = 8;

const DEFAULT_QUALITY = 75;

/*
 * GIFs with hundreds of frames can consume
 * a lot of memory on phones.
 */
const MAX_FRAMES = 120;

/* ======================================================
   STATE
====================================================== */

let selectedFiles = [];

let generatedStickers = [];

let generatedPack = null;

/* ======================================================
   BASIC HELPERS
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

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(2)} MB`;
}

function isGIF(file) {
  return (
    file.type === "image/gif" ||
    /\.gif$/i.test(file.name)
  );
}

function isAnimatedPack() {
  return selectedFiles.some(
    file => isGIF(file)
  );
}

function isStaticPack() {
  return selectedFiles.some(
    file => !isGIF(file)
  );
}

/* ======================================================
   PACK VALIDATION
====================================================== */

function getPackType() {
  const animated =
    isAnimatedPack();

  const staticPack =
    isStaticPack();

  if (
    animated &&
    staticPack
  ) {
    throw new Error(
      "لا يمكن خلط GIF المتحرك مع الصور الثابتة في نفس الحزمة. أنشئ حزمة متحركة بالكامل أو حزمة ثابتة بالكامل."
    );
  }

  return animated
    ? "animated"
    : "static";
}

/* ======================================================
   LOAD IMAGE
====================================================== */

function loadImage(file) {
  return new Promise(
    (resolve, reject) => {

      const url =
        URL.createObjectURL(file);

      const img =
        new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);

        reject(
          new Error(
            "تعذر فتح الصورة."
          )
        );
      };

      img.src = url;
    }
  );
}

/* ======================================================
   CREATE 512x512 CANVAS
====================================================== */

function createSquareCanvas(
  img,
  size = SIZE
) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = size;
  canvas.height = size;

  const ctx =
    canvas.getContext(
      "2d",
      {
        alpha: true
      }
    );

  ctx.clearRect(
    0,
    0,
    size,
    size
  );

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

/* ======================================================
   CANVAS -> RGBA
====================================================== */

function getRGBA(canvas) {
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
   STATIC WEBP
====================================================== */

async function encodeStaticCanvas(
  canvas,
  quality
) {
  const imageData =
    getRGBA(canvas);

  const result =
    await encodeRGBA(
      imageData.data,
      canvas.width,
      canvas.height,
      true,
      {
        lossless: 0,
        quality
      }
    );

  if (!result) {
    throw new Error(
      "تعذر إنشاء WebP."
    );
  }

  return new Blob(
    [result],
    {
      type: "image/webp"
    }
  );
}

/* ======================================================
   STATIC STICKER COMPRESSION
====================================================== */

async function makeStaticSticker(
  file
) {
  const img =
    await loadImage(file);

  let canvas =
    createSquareCanvas(
      img,
      SIZE
    );

  /*
   * نحاول الوصول إلى أقل من 100KB
   * مع أعلى جودة ممكنة.
   */

  const qualities = [
    90,
    82,
    75,
    68,
    60,
    52,
    45,
    38,
    30,
    22,
    15,
    8,
    1
  ];

  for (
    const quality of qualities
  ) {
    const blob =
      await encodeStaticCanvas(
        canvas,
        quality
      );

    if (
      blob.size <=
      STATIC_MAX
    ) {
      return {
        blob,
        animated: false
      };
    }
  }

  /*
   * إذا لم نصل إلى 100KB،
   * نقلل الدقة الداخلية ثم نعيد
   * إخراجها في 512x512.
   */

  const fallbackSizes = [
    448,
    384,
    320,
    256,
    224,
    192
  ];

  for (
    const smallSize
    of fallbackSizes
  ) {

    canvas =
      createSquareCanvas(
        img,
        smallSize
      );

    for (
      const quality of [
        45,
        30,
        20,
        10,
        1
      ]
    ) {

      const smallBlob =
        await encodeStaticCanvas(
          canvas,
          quality
        );

      if (
        smallBlob.size >
        STATIC_MAX
      ) {
        continue;
      }

      /*
       * إعادة الرسم في 512x512
       */

      const finalCanvas =
        document.createElement(
          "canvas"
        );

      finalCanvas.width =
        SIZE;

      finalCanvas.height =
        SIZE;

      const ctx =
        finalCanvas.getContext(
          "2d"
        );

      ctx.imageSmoothingEnabled =
        true;

      ctx.imageSmoothingQuality =
        "high";

      ctx.drawImage(
        canvas,
        0,
        0,
        SIZE,
        SIZE
      );

      for (
        const finalQuality of [
          30,
          20,
          10,
          1
        ]
      ) {

        const finalBlob =
          await encodeStaticCanvas(
            finalCanvas,
            finalQuality
          );

        if (
          finalBlob.size <=
          STATIC_MAX
        ) {
          return {
            blob: finalBlob,
            animated: false
          };
        }
      }
    }
  }

  throw new Error(
    "تعذر ضغط أحد الملصقات الثابتة تحت 100KB."
  );
}

/* ======================================================
   GIF DECODER
====================================================== */

async function decodeGIF(
  file
) {
  const buffer =
    await file.arrayBuffer();

  const gif =
    parseGIF(buffer);

  const frames =
    decompressFrames(
      gif,
      true
    );

  if (
    !frames ||
    !frames.length
  ) {
    throw new Error(
      "ملف GIF لا يحتوي على إطارات."
    );
  }

  return {
    gif,
    frames
  };
}

/* ======================================================
   GIF -> FULL RGBA FRAMES
====================================================== */

function gifFramesToRGBA(
  gif,
  frames
) {
  const width =
    gif.lsd.width;

  const height =
    gif.lsd.height;

  /*
   * Canvas يمثل الحالة الحالية
   * للـGIF.
   */

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    width;

  canvas.height =
    height;

  const ctx =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  const output = [];

  let previousFrameState =
    null;

  for (
    let i = 0;
    i < frames.length;
    i++
  ) {

    const frame =
      frames[i];

    /*
     * قبل رسم الإطار الحالي،
     * نطبق disposal للإطار السابق.
     */

    if (
      previousFrameState
    ) {

      const previous =
        previousFrameState.frame;

      if (
        previous.disposalType ===
        2
      ) {

        const d =
          previous.dims;

        ctx.clearRect(
          d.left,
          d.top,
          d.width,
          d.height
        );

      } else if (
        previous.disposalType ===
        3 &&
        previousFrameState.restoreCanvas
      ) {

        ctx.putImageData(
          previousFrameState.restoreCanvas,
          0,
          0
        );
      }
    }

    /*
     * disposal 3 يعني:
     * احفظ الحالة قبل رسم هذا
     * الإطار لكي نرجع لها بعده.
     */

    let restoreCanvas =
      null;

    if (
      frame.disposalType ===
      3
    ) {

      restoreCanvas =
        ctx.getImageData(
          0,
          0,
          width,
          height
        );
    }

    /*
     * frame.patch يمثل المنطقة
     * التي يجب رسمها.
     */

    const patchCanvas =
      document.createElement(
        "canvas"
      );

    patchCanvas.width =
      frame.dims.width;

    patchCanvas.height =
      frame.dims.height;

    const patchCtx =
      patchCanvas.getContext(
        "2d"
      );

    const patchImage =
      new ImageData(
        new Uint8ClampedArray(
          frame.patch
        ),
        frame.dims.width,
        frame.dims.height
      );

    patchCtx.putImageData(
      patchImage,
      0,
      0
    );

    ctx.drawImage(
      patchCanvas,
      frame.dims.left,
      frame.dims.top
    );

    /*
     * نأخذ لقطة كاملة للإطار
     * بعد تطبيق patch.
     */

    const fullFrame =
      ctx.getImageData(
        0,
        0,
        width,
        height
      );

    output.push({
      data:
        new Uint8Array(
          fullFrame.data
        ),
      duration:
        Math.max(
          MIN_FRAME_MS,
          Number(frame.delay) || 100
        )
    });

    previousFrameState = {
      frame,
      restoreCanvas
    };
  }

  return {
    width,
    height,
    frames: output
  };
}

/* ======================================================
   CROP / COVER FRAME TO 512x512
====================================================== */

function resizeRGBAFrame(
  rgba,
  sourceWidth,
  sourceHeight
) {
  const sourceCanvas =
    document.createElement(
      "canvas"
    );

  sourceCanvas.width =
    sourceWidth;

  sourceCanvas.height =
    sourceHeight;

  const sourceCtx =
    sourceCanvas.getContext(
      "2d"
    );

  sourceCtx.putImageData(
    new ImageData(
      new Uint8ClampedArray(
        rgba
      ),
      sourceWidth,
      sourceHeight
    ),
    0,
    0
  );

  const outputCanvas =
    document.createElement(
      "canvas"
    );

  outputCanvas.width =
    SIZE;

  outputCanvas.height =
    SIZE;

  const outputCtx =
    outputCanvas.getContext(
      "2d"
    );

  outputCtx.clearRect(
    0,
    0,
    SIZE,
    SIZE
  );

  const scale =
    Math.max(
      SIZE / sourceWidth,
      SIZE / sourceHeight
    );

  const width =
    sourceWidth * scale;

  const height =
    sourceHeight * scale;

  const x =
    (SIZE - width) / 2;

  const y =
    (SIZE - height) / 2;

  outputCtx.imageSmoothingEnabled =
    true;

  outputCtx.imageSmoothingQuality =
    "high";

  outputCtx.drawImage(
    sourceCanvas,
    x,
    y,
    width,
    height
  );

  return outputCtx.getImageData(
    0,
    0,
    SIZE,
    SIZE
  ).data;
}

/* ======================================================
   LIMIT ANIMATION DURATION
====================================================== */

function limitAnimation(
  frames
) {
  let total =
    frames.reduce(
      (sum, frame) =>
        sum + frame.duration,
      0
    );

  if (
    total <=
    MAX_ANIMATION_MS
  ) {
    return frames;
  }

  /*
   * نحاول تقليل المدة
   * مع المحافظة على >= 8ms.
   */

  const factor =
    MAX_ANIMATION_MS /
    total;

  return frames.map(
    frame => ({
      ...frame,
      duration:
        Math.max(
          MIN_FRAME_MS,
          Math.floor(
            frame.duration *
            factor
          )
        )
    })
  );
}

/* ======================================================
   REDUCE FRAME COUNT
====================================================== */

function reduceFrameCount(
  frames
) {
  if (
    frames.length <=
    MAX_FRAMES
  ) {
    return frames;
  }

  const step =
    frames.length /
    MAX_FRAMES;

  const result = [];

  for (
    let i = 0;
    i < MAX_FRAMES;
    i++
  ) {

    const index =
      Math.floor(
        i * step
      );

    const frame =
      frames[index];

    result.push({
      data:
        frame.data,
      duration:
        frame.duration *
        step
    });
  }

  return result;
}

/* ======================================================
   ENCODE ANIMATED WEBP
====================================================== */

async function encodeAnimated(
  frames
) {
  const qualities = [
    70,
    60,
    50,
    40,
    30,
    20,
    10
  ];

  for (
    const quality
    of qualities
  ) {

    const configuredFrames =
      frames.map(
        frame => ({
          data:
            frame.data,
          duration:
            Math.max(
              MIN_FRAME_MS,
              Math.round(
                frame.duration
              )
            ),
          config: {
            lossless: 0,
            quality
          }
        })
      );

    const result =
      await encodeAnimation(
        SIZE,
        SIZE,
        true,
        configuredFrames
      );

    if (!result) {
      continue;
    }

    const blob =
      new Blob(
        [result],
        {
          type:
            "image/webp"
        }
      );

    if (
      blob.size <=
      ANIMATED_MAX
    ) {
      return blob;
    }
  }

  /*
   * إذا بقي الملف أكبر من 500KB،
   * نقلل عدد الإطارات.
   */

  if (
    frames.length > 12
  ) {

    const reduced =
      frames.filter(
        (_, index) =>
          index % 2 === 0
      );

    return encodeAnimated(
      reduced
    );
  }

  throw new Error(
    "تعذر ضغط الملصق المتحرك تحت 500KB. جرّب GIF أقصر أو أقل عددًا من الإطارات."
  );
}

/* ======================================================
   MAKE ANIMATED STICKER
====================================================== */

async function makeAnimatedSticker(
  file
) {
  const decoded =
    await decodeGIF(
      file
    );

  let frames =
    gifFramesToRGBA(
      decoded.gif,
      decoded.frames
    );

  /*
   * الحد الأقصى للمدة.
   */

  frames =
    limitAnimation(
      frames
    );

  /*
   * تقليل الإطارات إذا كان
   * GIF ضخمًا.
   */

  frames =
    reduceFrameCount(
      frames
    );

  /*
   * تحويل كل frame إلى
   * 512x512.
   */

  const resizedFrames =
    frames.map(
      frame => ({
        data:
          resizeRGBAFrame(
            frame.data,
            decoded.width,
            decoded.height
          ),
        duration:
          frame.duration
      })
    );

  const blob =
    await encodeAnimated(
      resizedFrames
    );

  if (
    blob.size >
    ANIMATED_MAX
  ) {
    throw new Error(
      `حجم الملصق المتحرك ${formatBytes(
        blob.size
      )} وهو أكبر من 500KB.`
    );
  }

  return {
    blob,
    animated: true
  };
}

/* ======================================================
   COVER
====================================================== */

async function createCover() {
  const first =
    selectedFiles[0];

  let img;

  /*
   * الغلاف يأخذ أول إطار من GIF
   * إذا كانت الحزمة متحركة.
   */

  if (
    isGIF(first)
  ) {

    const decoded =
      await decodeGIF(
        first
      );

    const frames =
      gifFramesToRGBA(
        decoded.gif,
        decoded.frames
      );

    const firstFrame =
      frames[0];

    const resized =
      resizeRGBAFrame(
        firstFrame.data,
        decoded.width,
        decoded.height
      );

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      COVER_SIZE;

    canvas.height =
      COVER_SIZE;

    const ctx =
      canvas.getContext(
        "2d"
      );

    const temp =
      document.createElement(
        "canvas"
      );

    temp.width =
      SIZE;

    temp.height =
      SIZE;

    temp
      .getContext("2d")
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(
            resized
          ),
          SIZE,
          SIZE
        ),
        0,
        0
      );

    ctx.drawImage(
      temp,
      0,
      0,
      COVER_SIZE,
      COVER_SIZE
    );

    return canvasToPNG(
      canvas
    );
  }

  const img =
    await loadImage(
      first
    );

  const canvas =
    createSquareCanvas(
      img,
      COVER_SIZE
    );

  return canvasToPNG(
    canvas
  );
}

function canvasToPNG(
  canvas
) {
  return new Promise(
    (resolve, reject) => {

      canvas.toBlob(
        blob => {

          if (!blob) {
            reject(
              new Error(
                "تعذر إنشاء غلاف الحزمة."
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
   BUILD PACK
====================================================== */

async function buildPack() {
  const name =
    packNameInput.value.trim() ||
    "Miku Stickers";

  const cover =
    await createCover();

  return {
    name,
    publisher:
      "Miku Stickers",
    identifier:
      `com.miku.stickers.${Date.now()}`,
    cover,
    animated:
      generatedStickers.every(
        sticker =>
          sticker.animated
      ),
    stickers:
      generatedStickers
  };
}

/* ======================================================
   BUILD .WASTICKERS
====================================================== */

async function createWastickers() {
  if (
    !generatedPack ||
    !generatedStickers.length
  ) {
    throw new Error(
      "أنشئ الحزمة أولًا."
    );
  }

  if (
    typeof JSZip ===
    "undefined"
  ) {
    throw new Error(
      "JSZip غير محملة. تأكد من وجودها في index.html."
    );
  }

  const zip =
    new JSZip();

  /*
   * مهم:
   * الملفات مباشرة في جذر ZIP.
   */

  zip.file(
    "title.txt",
    generatedPack.name
  );

  zip.file(
    "author.txt",
    generatedPack.publisher
  );

  zip.file(
    "cover.png",
    generatedPack.cover
  );

  for (
    let i = 0;
    i <
    generatedStickers.length;
    i++
  ) {

    const sticker =
      generatedStickers[i];

    zip.file(
      `${i}.webp`,
      sticker.blob
    );
  }

  return zip.generateAsync({
    type: "blob",
    compression:
      "DEFLATE",
    compressionOptions: {
      level: 6
    }
  });
}

/* ======================================================
   SHARE
====================================================== */

async function shareFile(
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

  const file =
    new File(
      [blob],
      `${safeName}.wastickers`,
      {
        type:
          "application/octet-stream"
      }
    );

  /*
   * iOS / Android Web Share
   */

  if (
    navigator.share &&
    navigator.canShare
  ) {

    try {

      const supported =
        navigator.canShare({
          files: [file]
        });

      if (
        supported
      ) {

        await navigator.share({
          title:
            safeName,
          text:
            "Miku Stickers",
          files: [file]
        });

        return;
      }

    } catch (error) {

      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }

      console.warn(
        "Share failed:",
        error
      );
    }
  }

  /*
   * Fallback
   */

  downloadFile(
    blob,
    `${safeName}.wastickers`
  );
}

/* ======================================================
   DOWNLOAD
====================================================== */

function downloadFile(
  blob,
  filename
) {
  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  link.download =
    filename;

  link.style.display =
    "none";

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
    3000
  );
}

/* ======================================================
   PREVIEW
====================================================== */

async function renderPreview() {
  preview.innerHTML = "";

  for (
    let i = 0;
    i <
    selectedFiles.length;
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

    const type =
      document.createElement(
        "div"
      );

    type.className =
      "sticker-type";

    type.textContent =
      isGIF(file)
        ? "GIF متحرك"
        : "صورة";

    const url =
      URL.createObjectURL(
        file
      );

    img.src =
      url;

    img.onload =
      () => {
        URL.revokeObjectURL(
          url
        );
      };

    card.appendChild(
      img
    );

    card.appendChild(
      number
    );

    card.appendChild(
      size
    );

    card.appendChild(
      type
    );

    preview.appendChild(
      card
    );
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

    selectedFiles =
      [];

    generatedStickers =
      [];

    generatedPack =
      null;

    whatsappButton.disabled =
      true;

    if (
      files.length <
        MIN_STICKERS ||
      files.length >
        MAX_STICKERS
    ) {

      preview.innerHTML =
        "";

      createButton.disabled =
        true;

      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف.`
      );

      return;
    }

    const hasGIF =
      files.some(
        file => isGIF(file)
      );

    const hasStatic =
      files.some(
        file => !isGIF(file)
      );

    if (
      hasGIF &&
      hasStatic
    ) {

      preview.innerHTML =
        "";

      createButton.disabled =
        true;

      setStatus(
        "لا يمكن خلط GIF المتحرك مع الصور الثابتة في نفس الحزمة."
      );

      bridgeStatus.textContent =
        "الحزمة يجب أن تكون كلها متحركة أو كلها ثابتة.";

      return;
    }

    selectedFiles =
      files;

    await renderPreview();

    createButton.disabled =
      false;

    bridgeStatus.textContent =
      hasGIF
        ? "حزمة Animated WebP."
        : "حزمة WebP ثابتة.";

    setStatus(
      `تم اختيار ${files.length} ملف.`
    );
  }
);

/* ======================================================
   CREATE BUTTON
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
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف.`
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

      const packType =
        getPackType();

      for (
        let i = 0;
        i <
        selectedFiles.length;
        i++
      ) {

        const file =
          selectedFiles[i];

        setStatus(
          packType ===
          "animated"
            ? `جاري تحويل الملصق المتحرك ${i + 1} من ${selectedFiles.length}...`
            : `جاري تحويل الملصق ${i + 1} من ${selectedFiles.length}...`
        );

        let result;

        if (
          packType ===
          "animated"
        ) {

          result =
            await makeAnimatedSticker(
              file
            );

        } else {

          result =
            await makeStaticSticker(
              file
            );
        }

        generatedStickers.push({
          index: i,
          blob:
            result.blob,
          animated:
            result.animated
        });

        /*
         * تحديث حجم البطاقة.
         */

        const cards =
          preview.querySelectorAll(
            ".sticker-card"
          );

        const card =
          cards[i];

        if (card) {

          const size =
            card.querySelector(
              ".sticker-size"
            );

          const type =
            card.querySelector(
              ".sticker-type"
            );

          if (size) {
            size.textContent =
              formatBytes(
                result.blob.size
              );
          }

          if (type) {
            type.textContent =
              result.animated
                ? "Animated WebP"
                : "WebP";
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
        packType ===
        "animated"
          ? "الحزمة المتحركة جاهزة."
          : "الحزمة جاهزة.";

      setStatus(
        `تم تجهيز ${generatedStickers.length} ملصق بنجاح.`
      );

    } catch (error) {

      console.error(
        error
      );

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
   SHARE BUTTON
====================================================== */

whatsappButton.addEventListener(
  "click",
  async () => {

    if (
      !generatedPack
    ) {

      setStatus(
        "أنشئ الحزمة أولًا."
      );

      return;
    }

    whatsappButton.disabled =
      true;

    try {

      setStatus(
        "جاري إنشاء ملف .wastickers..."
      );

      bridgeStatus.textContent =
        "جاري ضغط الحزمة...";

      const blob =
        await createWastickers();

      bridgeStatus.textContent =
        "جاري فتح المشاركة...";

      await shareFile(
        blob
      );

      bridgeStatus.textContent =
        "تم تجهيز الحزمة للمشاركة.";

      setStatus(
        "اختر Sticker Maker من قائمة المشاركة."
      );

    } catch (error) {

      console.error(
        error
      );

      bridgeStatus.textContent =
        "تعذر مشاركة الحزمة.";

      setStatus(
        error?.message ||
        "حدث خطأ أثناء مشاركة الحزمة."
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
  `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف.`
);
