"use strict";

const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const createButton = document.getElementById("createButton");
const whatsappButton = document.getElementById("whatsappButton");
const bridgeStatus = document.getElementById("bridgeStatus");

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;

let selectedFiles = [];
let generatedFiles = [];

/* =========================
   الحالة
========================= */

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

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/* =========================
   أنواع الملفات
========================= */

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
    /\.(png|jpe?g|webp)$/i.test(file.name)
  );
}

function isSupported(file) {
  return isGIF(file) || isStaticImage(file);
}

/* =========================
   Object URL
========================= */

function revokeURL(url) {
  try {
    URL.revokeObjectURL(url);
  } catch (_) {}
}

/* =========================
   المعاينة
========================= */

function renderPreview(files) {
  preview.innerHTML = "";

  files.forEach((file, index) => {
    const card = document.createElement("div");
    card.className = "sticker-card";

    const img = document.createElement("img");

    const number = document.createElement("div");
    number.className = "sticker-number";
    number.textContent = `#${index + 1}`;

    const size = document.createElement("div");
    size.className = "sticker-size";
    size.textContent = formatBytes(file.size);

    const type = document.createElement("div");
    type.className = "sticker-type";
    type.textContent = isGIF(file)
      ? "GIF متحرك"
      : "صورة";

    const url = URL.createObjectURL(file);

    img.src = url;
    img.alt = `ملصق ${index + 1}`;

    img.onload = () => {
      /*
       * لا نحذف الـURL مباشرة للـGIF
       * حتى لا يتوقف تشغيل المعاينة.
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

/* =========================
   اختيار الملفات
========================= */

fileInput.addEventListener("change", () => {
  const files = Array.from(
    fileInput.files || []
  );

  selectedFiles = [];
  generatedFiles = [];

  whatsappButton.disabled = true;

  if (!files.length) {
    preview.innerHTML = "";
    createButton.disabled = true;

    setStatus("لم يتم اختيار أي ملف.");
    setBridgeStatus("Miku Stickers جاهز.");

    return;
  }

  if (
    files.length < MIN_STICKERS ||
    files.length > MAX_STICKERS
  ) {
    preview.innerHTML = "";
    createButton.disabled = true;

    setStatus(
      `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف. تم اختيار ${files.length}.`
    );

    setBridgeStatus(
      "عدد الملفات غير صحيح."
    );

    return;
  }

  const unsupported = files.filter(
    file => !isSupported(file)
  );

  if (unsupported.length) {
    preview.innerHTML = "";
    createButton.disabled = true;

    setStatus(
      "يوجد ملف غير مدعوم. استخدم PNG أو JPG أو WEBP أو GIF فقط."
    );

    setBridgeStatus(
      `الملف غير المدعوم: ${unsupported[0].name}`
    );

    return;
  }

  selectedFiles = files;

  renderPreview(selectedFiles);

  createButton.disabled = false;

  const gifCount = files.filter(isGIF).length;
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
  } else if (gifCount > 0) {
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
});

/* =========================
   تحميل صورة
========================= */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();

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
  });
}

/* =========================
   Canvas 512×512
========================= */

async function imageToCanvas(file) {
  const img = await loadImage(file);

  const canvas =
    document.createElement("canvas");

  canvas.width = 512;
  canvas.height = 512;

  const ctx =
    canvas.getContext("2d", {
      alpha: true
    });

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

  const scale = Math.min(
    512 / img.width,
    512 / img.height
  );

  const width =
    Math.round(img.width * scale);

  const height =
    Math.round(img.height * scale);

  const x =
    Math.round((512 - width) / 2);

  const y =
    Math.round((512 - height) / 2);

  ctx.drawImage(
    img,
    x,
    y,
    width,
    height
  );

  return canvas;
}

/* =========================
   WebP
========================= */

function canvasToWebP(
  canvas,
  quality = 0.82
) {
  return new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(
              new Error(
                "تعذر إنشاء WebP."
              )
            );

            return;
          }

          resolve(blob);
        },
        "image/webp",
        quality
      );
    }
  );
}

/* =========================
   صورة ثابتة
========================= */

async function createStaticSticker(file) {
  const canvas =
    await imageToCanvas(file);

  let quality = 0.82;

  let blob =
    await canvasToWebP(
      canvas,
      quality
    );

  while (
    blob.size > 100 * 1024 &&
    quality > 0.25
  ) {
    quality -= 0.08;

    blob =
      await canvasToWebP(
        canvas,
        quality
      );
  }

  if (blob.size > 100 * 1024) {
    throw new Error(
      `${file.name} ما قدرنا نضغطه إلى أقل من 100KB.`
    );
  }

  return new File(
    [blob],
    `sticker-${Date.now()}.webp`,
    {
      type: "image/webp"
    }
  );
}

/* =========================
   فحص GIF
========================= */

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

  /*
   * مهم:
   * لا يوجد هنا frames.reduce
   * ولا wasm-webp.
   */

  return {
    file,
    buffer
  };
}

/* =========================
   Cover
========================= */

async function createCover(file) {
  /*
   * إذا كان أول ملف GIF،
   * نستخدم GIF نفسه كصورة للغلاف
   * عبر عنصر Image.
   */

  const canvas =
    await imageToCanvas(file);

  const cover =
    document.createElement("canvas");

  cover.width = 96;
  cover.height = 96;

  const ctx =
    cover.getContext("2d");

  if (!ctx) {
    throw new Error(
      "تعذر إنشاء الغلاف."
    );
  }

  ctx.drawImage(
    canvas,
    0,
    0,
    96,
    96
  );

  return new Promise(
    (resolve, reject) => {
      cover.toBlob(
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
                type: "image/png"
              }
            )
          );
        },
        "image/png"
      );
    }
  );
}

/* =========================
   إنشاء الملفات
========================= */

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
      `جاري تجهيز الملف ${i + 1} من ${selectedFiles.length}...`
    );

    if (isGIF(file)) {
      /*
       * حاليًا نحتفظ بالـGIF كما هو.
       * لا نحاول تحويله إلى WebP متحرك
       * قبل إضافة Encoder متحرك موثوق.
       */

      await prepareGIF(file);

      outputFiles.push({
        original: file,
        output: file,
        animated: true
      });

    } else {
      const webp =
        await createStaticSticker(
          file
        );

      outputFiles.push({
        original: file,
        output: webp,
        animated: false
      });
    }

    if (i === 0) {
      coverFile =
        await createCover(file);
    }
  }

  return {
    packName,
    files: outputFiles,
    cover: coverFile
  };
}

/* =========================
   إنشاء
========================= */

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

    createButton.disabled = true;
    whatsappButton.disabled = true;

    try {
      setBridgeStatus(
        "جاري تجهيز الملفات..."
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
        "تم تجهيز الملفات بنجاح."
      );

      whatsappButton.disabled =
        false;

    } catch (error) {
      console.error(
        "Miku Stickers error:",
        error
      );

      setStatus(
        error?.message ||
        "حدث خطأ أثناء تجهيز الملفات."
      );

      setBridgeStatus(
        "تعذر تجهيز الملفات."
      );

    } finally {
      createButton.disabled =
        false;
    }
  }
);

/* =========================
   المشاركة
========================= */

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
          item => item.output
        );

      if (
        navigator.share &&
        navigator.canShare &&
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
        "Share error:",
        error
      );

      setStatus(
        "تعذر فتح قائمة المشاركة."
      );
    }
  }
);

/* =========================
   البداية
========================= */

createButton.disabled = true;
whatsappButton.disabled = true;

setStatus(
  `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} صورة أو GIF.`
);

setBridgeStatus(
  "Miku Stickers جاهز."
);
