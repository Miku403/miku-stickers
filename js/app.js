"use strict";

/*
=========================================================
 MIKU STICKERS
 Images + GIF
 -> WhatsApp-ready .wastickers
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

const STATIC_MAX_SIZE = 100 * 1024;
const ANIMATED_MAX_SIZE = 500 * 1024;

const COVER_SIZE = 96;
const COVER_MAX_SIZE = 50 * 1024;

const QUALITY_START = 90;
const QUALITY_MIN = 1;

const MAX_ANIMATION_SECONDS = 10;
const MIN_FRAME_DURATION = 8;

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

function isGif(file) {
  return (
    file.type === "image/gif" ||
    /\.gif$/i.test(file.name)
  );
}

function isAnimatedFile(file) {
  return isGif(file);
}

function hasAnimatedFiles() {
  return selectedFiles.some(isAnimatedFile);
}

function hasStaticFiles() {
  return selectedFiles.some(file => !isAnimatedFile(file));
}

function validatePackType() {
  const animated = hasAnimatedFiles();
  const staticFiles = hasStaticFiles();

  if (animated && staticFiles) {
    throw new Error(
      "لا يمكن خلط GIF مع الصور الثابتة في نفس الحزمة. أنشئ حزمة متحركة بالكامل أو حزمة ثابتة بالكامل."
    );
  }

  return animated ? "animated" : "static";
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
      reject(
        new Error("تعذر فتح الصورة.")
      );
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
   WEBP STATIC ENCODER
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
    blob.size <= 0
  ) {
    throw new Error(
      "ملف WebP الناتج فارغ."
    );
  }

  return blob;
}

/* ======================================================
   STATIC STICKER
====================================================== */

async function makeStaticSticker(
  img
) {
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
   * البحث عن أعلى جودة تحت 100KB
   */

  for (
    let i = 0;
    i < 12;
    i++
  ) {
    if (low > high) {
      break;
    }

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
      blob.size <=
      STATIC_MAX_SIZE
    ) {
      bestBlob = blob;
      low = quality + 1;
    } else {
      high = quality - 1;
    }
  }

  /*
   * جودة دنيا
   */

  if (!bestBlob) {
    const blob =
      await encodeCanvas(
        canvas,
        QUALITY_MIN
      );

    if (
      blob.size <=
      STATIC_MAX_SIZE
    ) {
      bestBlob = blob;
    }
  }

  /*
   * تقليل الأبعاد داخليًا ثم إعادة
   * رفعها إلى 512x512 إذا احتجنا ذلك.
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
      128
    ];

    for (
      const smallSize
      of fallbackSizes
    ) {
      const smallCanvas =
        createStickerCanvas(
          img,
          smallSize
        );

      const smallBlob =
        await encodeCanvas(
          smallCanvas,
          QUALITY_MIN
        );

      if (
        smallBlob.size >
        STATIC_MAX_SIZE
      ) {
        continue;
      }

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
        finalBlob.size <=
        STATIC_MAX_SIZE
      ) {
        bestBlob =
          finalBlob;

        break;
      }
    }
  }

  if (!bestBlob) {
    throw new Error(
      "تعذر ضغط الملصق الثابت تحت 100KB."
    );
  }

  return {
    blob: bestBlob,
    animated: false
  };
}

/* ======================================================
   GIF -> FRAMES USING IMAGEDECODER
====================================================== */

async function decodeGifWithImageDecoder(
  file
) {
  if (
    typeof ImageDecoder ===
    "undefined"
  ) {
    throw new Error(
      "هذا المتصفح لا يدعم تحويل GIF المتحرك داخل الموقع. جرّب Chrome على Android أو استخدم GIF أقصر."
    );
  }

  const buffer =
    await file.arrayBuffer();

  const supported =
    await ImageDecoder.isTypeSupported(
      "image/gif"
    );

  if (!supported) {
    throw new Error(
      "المتصفح لا يدعم فك GIF باستخدام ImageDecoder."
    );
  }

  const decoder =
    new ImageDecoder({
      data: buffer,
      type: "image/gif",
      preferAnimation: true
    });

  await decoder.tracks.ready;

  const track =
    decoder.tracks.selectedTrack;

  if (!track) {
    throw new Error(
      "تعذر قراءة مسار GIF."
    );
  }

  const frameCount =
    track.frameCount || 1;

  /*
   * نحدد مدة GIF الأصلية قدر الإمكان.
   */

  const frames = [];

  for (
    let i = 0;
    i < frameCount;
    i++
  ) {
    const result =
      await decoder.decode({
        frameIndex: i,
        completeFramesOnly: true
      });

    const videoFrame =
      result.image;

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      STICKER_SIZE;

    canvas.height =
      STICKER_SIZE;

    const ctx =
      canvas.getContext(
        "2d",
        {
          alpha: true
        }
      );

    /*
     * تحويل VideoFrame إلى
     * Canvas مع الحفاظ على
     * النسبة.
     */

    const sourceWidth =
      videoFrame.displayWidth ||
      videoFrame.codedWidth;

    const sourceHeight =
      videoFrame.displayHeight ||
      videoFrame.codedHeight;

    const scale =
      Math.max(
        STICKER_SIZE /
          sourceWidth,
        STICKER_SIZE /
          sourceHeight
      );

    const width =
      sourceWidth * scale;

    const height =
      sourceHeight * scale;

    const x =
      (STICKER_SIZE -
        width) /
      2;

    const y =
      (STICKER_SIZE -
        height) /
      2;

    ctx.clearRect(
      0,
      0,
      STICKER_SIZE,
      STICKER_SIZE
    );

    ctx.drawImage(
      videoFrame,
      x,
      y,
      width,
      height
    );

    /*
     * ImageDecoder يعطينا مدة
     * الإطار بالـ microseconds.
     */

    let duration =
      Number(
        result.image.duration || 0
      ) / 1000;

    if (
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      duration = 100;
    }

    /*
     * WhatsApp يحتاج >= 8ms.
     */

    duration =
      Math.max(
        MIN_FRAME_DURATION,
        Math.round(duration)
      );

    frames.push({
      imageData:
        canvasToRGBA(canvas),
      duration
    });

    if (
      typeof videoFrame.close ===
      "function"
    ) {
      videoFrame.close();
    }
  }

  decoder.close();

  return frames;
}

/* ======================================================
   GIF -> ANIMATED WEBP
====================================================== */

/*
 * ملاحظة:
 * ترميز Animated WebP يحتاج mux/encoder متحرك.
 *
 * إذا كان المتصفح لا يوفر API مناسب،
 * نوقف العملية بدل تحويل GIF لأول إطار.
 */

async function makeAnimatedSticker(
  file
) {
  /*
   * ImageDecoder يفك GIF إلى
   * frames كاملة.
   */

  const frames =
    await decodeGifWithImageDecoder(
      file
    );

  if (
    !frames.length
  ) {
    throw new Error(
      "ملف GIF لا يحتوي على إطارات."
    );
  }

  /*
   * الحد الأقصى للمدة 10 ثوانٍ.
   */

  let totalDuration =
    frames.reduce(
      (sum, frame) =>
        sum + frame.duration,
      0
    );

  if (
    totalDuration >
    MAX_ANIMATION_SECONDS * 1000
  ) {
    const factor =
      (MAX_ANIMATION_SECONDS *
        1000) /
      totalDuration;

    for (
      const frame
      of frames
    ) {
      frame.duration =
        Math.max(
          MIN_FRAME_DURATION,
          Math.floor(
            frame.duration *
              factor
          )
        );
    }

    totalDuration =
      frames.reduce(
        (sum, frame) =>
          sum + frame.duration,
        0
      );
  }

  /*
   * محاولة استخدام WebCodecs
   * إذا كان المتصفح يدعم
   * ImageEncoder.
   *
   * بعض المتصفحات قد لا توفر
   * Animated WebP encoding.
   */

  if (
    typeof ImageEncoder !==
    "undefined"
  ) {
    try {
      const result =
        await encodeAnimatedWithImageEncoder(
          frames
        );

      if (
        result &&
        result.size <=
        ANIMATED_MAX_SIZE
      ) {
        return {
          blob: result,
          animated: true
        };
      }
    } catch (error) {
      console.warn(
        "ImageEncoder animation failed:",
        error
      );
    }
  }

  /*
   * لا نحول GIF إلى صورة ثابتة
   * لأن المستخدم طلب ملصقًا متحركًا.
   */

  throw new Error(
    "تم اكتشاف GIF متحرك، لكن هذا المتصفح لا يوفر ترميز Animated WebP المطلوب لواتساب. جرّب Chrome على Android أو متصفحًا يدعم Animated WebP Encoding."
  );
}

/* ======================================================
   OPTIONAL IMAGEENCODER ANIMATED WEBP
====================================================== */

async function encodeAnimatedWithImageEncoder(
  frames
) {
  /*
   * هذه الواجهة تجريبية/غير متوفرة
   * في جميع المتصفحات.
   */

  if (
    typeof ImageEncoder ===
    "undefined"
  ) {
    throw new Error(
      "ImageEncoder غير متوفر."
    );
  }

  /*
   * نتحقق من النوع إن كانت
   * الدالة موجودة.
   */

  if (
    typeof ImageEncoder.isConfigSupported !==
    "function"
  ) {
    throw new Error(
      "ImageEncoder لا يوفر فحص الدعم."
    );
  }

  const config = {
    type: "image/webp",
    width: STICKER_SIZE,
    height: STICKER_SIZE,
    quality: 0.7,
    alpha: "keep",
    framerate: 15
  };

  const support =
    await ImageEncoder.isConfigSupported(
      config
    );

  if (
    !support ||
    !support.supported
  ) {
    throw new Error(
      "Animated WebP غير مدعوم."
    );
  }

  const chunks = [];

  let resolveDone;
  let rejectDone;

  const done =
    new Promise(
      (resolve, reject) => {
        resolveDone = resolve;
        rejectDone = reject;
      }
    );

  const encoder =
    new ImageEncoder({
      output(chunk) {
        chunks.push(
          chunk
        );
      },

      error(error) {
        rejectDone(
          error
        );
      }
    });

  encoder.configure(
    config
  );

  /*
   * ImageEncoder الحالي ليس
   * موحدًا في دعم animation
   * على كل الأجهزة، لذلك
   * نرسل الإطارات فقط إذا
   * قبل المتصفح الإعداد.
   */

  let timestamp = 0;

  for (
    let i = 0;
    i < frames.length;
    i++
  ) {
    const frame =
      frames[i];

    const imageData =
      frame.imageData;

    const videoFrame =
      new VideoFrame(
        imageData,
        {
          timestamp
        }
      );

    encoder.encode(
      videoFrame,
      {
        keyFrame:
          i === 0
      }
    );

    videoFrame.close();

    timestamp +=
      frame.duration *
      1000;
  }

  await encoder.flush();

  encoder.close();

  resolveDone();

  await done;

  /*
   * نحاول بناء WebP من chunks.
   *
   * ملاحظة:
   * WebCodecs يعطي chunks مشفرة،
   * وليس دائمًا ملف WebP RIFF جاهز.
   * إذا لم يكن chunk container متاحًا،
   * نرفض بدل إنشاء ملف غير صالح.
   */

  if (!chunks.length) {
    throw new Error(
      "لم ينتج Encoder أي بيانات."
    );
  }

  throw new Error(
    "المتصفح لا يوفر حاليًا مسارًا موثوقًا لبناء Animated WebP من ImageEncoder وحده."
  );
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

    const type =
      document.createElement(
        "div"
      );

    type.className =
      "sticker-type";

    type.textContent =
      isGif(file)
        ? "GIF"
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

    try {
      validatePackType();

      bridgeStatus.textContent =
        hasAnimatedFiles()
          ? "حزمة متحركة."
          : "حزمة ثابتة.";

    } catch (error) {
      bridgeStatus.textContent =
        error.message;
    }

    await renderPreview();

    createButton.disabled =
      false;

    setStatus(
      `تم اختيار ${files.length} ملف.`
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
        validatePackType();

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

        let sticker;

        if (
          packType ===
            "animated"
        ) {
          sticker =
            await makeAnimatedSticker(
              file
            );
        } else {
          const img =
            await loadImage(
              file
            );

          sticker =
            await makeStaticSticker(
              img
            );
        }

        const maxSize =
          sticker.animated
            ? ANIMATED_MAX_SIZE
            : STATIC_MAX_SIZE;

        if (
          sticker.blob.size >
          maxSize
        ) {
          throw new Error(
            `الملصق ${i + 1} حجمه ${formatBytes(
              sticker.blob.size
            )} وهو أكبر من الحد المسموح.`
          );
        }

        generatedStickers.push({
          index: i,
          blob:
            sticker.blob,
          animated:
            sticker.animated
        });

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

          const type =
            cards[i].querySelector(
              ".sticker-type"
            );

          if (image) {
            const url =
              URL.createObjectURL(
                sticker.blob
              );

            image.src =
              url;
          }

          if (size) {
            size.textContent =
              formatBytes(
                sticker.blob.size
              );
          }

          if (type) {
            type.textContent =
              sticker.animated
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
        "الحزمة جاهزة للمشاركة.";

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
   CREATE COVER
====================================================== */

async function createCoverBlob() {
  const first =
    selectedFiles[0];

  let img;

  /*
   * للـGIF نستخدم صورة
   * الغلاف الأولى.
   */

  if (
    isGif(first)
  ) {
    img =
      await loadImage(
        first
      );
  } else {
    img =
      await loadImage(
        first
      );
  }

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

  const scale =
    Math.max(
      COVER_SIZE /
        img.width,
      COVER_SIZE /
        img.height
    );

  const width =
    img.width * scale;

  const height =
    img.height * scale;

  const x =
    (COVER_SIZE -
      width) / 2;

  const y =
    (COVER_SIZE -
      height) / 2;

  ctx.clearRect(
    0,
    0,
    COVER_SIZE,
    COVER_SIZE
  );

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

          if (
            blob.size >
            COVER_MAX_SIZE
          ) {
            /*
             * الغلاف PNG يجب أن
             * يكون صغيرًا.
             * نحاول مرة أخرى بجودة
             * JPEG ليس مناسبًا،
             * لذلك نقبل PNG إن كان
             * ضمن الحد.
             */

            reject(
              new Error(
                "الغلاف أكبر من 50KB."
              )
            );

            return;
          }

          resolve(
            blob
          );
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

  const animated =
    generatedStickers.length > 0 &&
    generatedStickers.every(
      sticker =>
        sticker.animated
    );

  return {
    identifier,
    name,
    publisher:
      "Miku Stickers",
    cover,
    animated,
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

  if (
    typeof JSZip ===
    "undefined"
  ) {
    throw new Error(
      "مكتبة JSZip غير محملة."
    );
  }

  const zip =
    new JSZip();

  /*
   * مهم جدًا:
   *
   * لا ننشئ مجلدًا داخل ZIP.
   *
   * ملفات الحزمة تكون في الجذر.
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

  /*
   * أسماء Unix timestamp
   * لتوافق أفضل مع أدوات
   * .wastickers المعروفة.
   */

  const baseTime =
    Date.now();

  for (
    let i = 0;
    i <
    generatedStickers.length;
    i++
  ) {
    const sticker =
      generatedStickers[i];

    const extension =
      sticker.animated
        ? "webp"
        : "webp";

    zip.file(
      `${baseTime + i}.${extension}`,
      sticker.blob
    );
  }

  /*
   * لا نضيف pack.json
   * ولا identifier داخل ZIP.
   *
   * صيغة .wastickers تعتمد
   * على title.txt / author.txt /
   * cover.png / ملفات الملصقات.
   */

  const blob =
    await zip.generateAsync({
      type: "blob",
      compression:
        "DEFLATE",
      compressionOptions: {
        level: 6
      }
    });

  return blob;
}

/* ======================================================
   SHARE / DOWNLOAD
====================================================== */

async function shareWastickers(
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
   * Web Share API
   */

  if (
    navigator.share &&
    navigator.canShare
  ) {
    try {
      const canShare =
        navigator.canShare({
          files: [file]
        });

      if (canShare) {
        await navigator.share({
          title:
            safeName,
          text:
            "Miku Stickers",
          files: [file]
        });

        return "shared";
      }
    } catch (error) {
      /*
       * المستخدم أغلق
       * نافذة المشاركة.
       */

      if (
        error?.name ===
        "AbortError"
      ) {
        return "cancelled";
      }

      console.warn(
        "Share failed:",
        error
      );
    }
  }

  /*
   * Fallback:
   * تنزيل الملف.
   */

  downloadWastickers(
    blob
  );

  return "downloaded";
}

/* ======================================================
   DOWNLOAD
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

  link.href =
    url;

  link.download =
    `${safeName}.wastickers`;

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
   WHATSAPP / STICKER MAKER
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
        "جاري تجهيز الملف للمشاركة...";

      const wastickers =
        await createWastickersFile();

      const result =
        await shareWastickers(
          wastickers
        );

      if (
        result ===
        "shared"
      ) {
        bridgeStatus.textContent =
          "اختر Sticker Maker من قائمة المشاركة.";

        setStatus(
          "تم فتح قائمة المشاركة. اختر Sticker Maker."
        );
      } else if (
        result ===
        "downloaded"
      ) {
        bridgeStatus.textContent =
          "تم تنزيل ملف .wastickers.";

        setStatus(
          "تم تنزيل الحزمة. شارك الملف إلى Sticker Maker."
        );
      } else {
        bridgeStatus.textContent =
          "تم إلغاء المشاركة.";

        setStatus(
          "تم إلغاء المشاركة."
        );
      }

    } catch (error) {
      console.error(
        error
      );

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
