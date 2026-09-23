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
   أدوات عامة
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

function revokeObjectURL(url) {
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("تعذر حذف Object URL:", error);
    }
  }
}

/* =========================
   معاينة الملفات
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

    if (isGIF(file)) {
      type.textContent = "GIF متحرك";
    } else {
      type.textContent = "صورة";
    }

    const url = URL.createObjectURL(file);

    img.src = url;
    img.alt = `ملصق ${index + 1}`;

    img.onload = () => {
      revokeObjectURL(url);
    };

    img.onerror = () => {
      revokeObjectURL(url);
      console.error("تعذر عرض الملف:", file.name);
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
  const files = Array.from(fileInput.files || []);

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

  if (files.length < MIN_STICKERS || files.length > MAX_STICKERS) {
    preview.innerHTML = "";
    createButton.disabled = true;

    setStatus(
      `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف. تم اختيار ${files.length}.`
    );

    setBridgeStatus("عدد الملفات غير صحيح.");

    return;
  }

  const unsupportedFiles = files.filter(
    file => !isSupported(file)
  );

  if (unsupportedFiles.length > 0) {
    preview.innerHTML = "";
    createButton.disabled = true;

    setStatus(
      "يوجد ملف غير مدعوم. استخدم PNG أو JPG أو WEBP أو GIF فقط."
    );

    setBridgeStatus(
      `الملف غير المدعوم: ${unsupportedFiles[0].name}`
    );

    return;
  }

  selectedFiles = files;

  renderPreview(selectedFiles);

  createButton.disabled = false;
  whatsappButton.disabled = true;

  const gifCount = files.filter(isGIF).length;
  const imageCount = files.length - gifCount;

  if (gifCount > 0 && imageCount > 0) {
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
   تحميل صورة عادية
========================= */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      revokeObjectURL(url);
      reject(
        new Error(`تعذر قراءة الصورة: ${file.name}`)
      );
    };

    img.src = url;
  });
}

/* =========================
   تجهيز Canvas 512×512
========================= */

async function imageToCanvas(file) {
  const img = await loadImage(file);

  const canvas = document.createElement("canvas");

  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext("2d", {
    alpha: true
  });

  if (!ctx) {
    throw new Error("تعذر إنشاء Canvas.");
  }

  ctx.clearRect(0, 0, 512, 512);

  /*
    نحافظ على نسبة أبعاد الصورة
    ونضعها داخل 512×512.
  */

  const scale = Math.min(
    512 / img.width,
    512 / img.height
  );

  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const x = Math.round((512 - width) / 2);
  const y = Math.round((512 - height) / 2);

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
   تحويل صورة إلى WebP
========================= */

function canvasToWebP(canvas, quality = 0.82) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(
            new Error("تعذر إنشاء ملف WebP.")
          );
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

/* =========================
   ضغط الصورة حتى ≤100KB
========================= */

async function createStaticSticker(file) {
  const canvas = await imageToCanvas(file);

  let quality = 0.82;
  let blob = await canvasToWebP(
    canvas,
    quality
  );

  /*
    نحاول تقليل الجودة تدريجيًا
    إذا تجاوز الملف 100KB.
  */

  while (
    blob.size > 100 * 1024 &&
    quality > 0.25
  ) {
    quality -= 0.08;

    blob = await canvasToWebP(
      canvas,
      quality
    );
  }

  if (blob.size > 100 * 1024) {
    throw new Error(
      `تعذر ضغط ${file.name} إلى أقل من 100KB.`
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
   قراءة GIF
========================= */

async function readFileAsArrayBuffer(file) {
  return await file.arrayBuffer();
}

/*
  هذه الدالة حاليًا تفحص GIF
  وتجهزه للتحويل لاحقًا.

  لا نستخدم wasm-webp هنا حتى لا
  يتكرر الخطأ السابق.
*/

async function prepareGIF(file) {
  const buffer = await readFileAsArrayBuffer(file);

  if (!buffer || buffer.byteLength === 0) {
    throw new Error(
      `ملف GIF فارغ أو تالف: ${file.name}`
    );
  }

  return {
    file,
    buffer
  };
}

/* =========================
   إنشاء Cover
========================= */

async function createCover(file) {
  const canvas = await imageToCanvas(file);

  const coverCanvas = document.createElement("canvas");

  coverCanvas.width = 96;
  coverCanvas.height = 96;

  const ctx = coverCanvas.getContext("2d");

  if (!ctx) {
    throw new Error("تعذر إنشاء صورة الغلاف.");
  }

  ctx.drawImage(
    canvas,
    0,
    0,
    96,
    96
  );

  return new Promise((resolve, reject) => {
    coverCanvas.toBlob(
      blob => {
        if (!blob) {
          reject(
            new Error("تعذر إنشاء الغلاف.")
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
  });
}

/* =========================
   إنشاء الحزمة
========================= */

async function createStickerPack() {
  if (
    selectedFiles.length < MIN_STICKERS ||
    selectedFiles.length > MAX_STICKERS
  ) {
    throw new Error(
      `يجب اختيار من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف.`
    );
  }

  const packNameInput =
    document.getElementById("packName");

  const packName =
    packNameInput?.value.trim() ||
    "Miku Stickers";

  const outputFiles = [];

  let coverFile = null;

  /*
    نعالج الملفات واحدًا واحدًا
    حتى لا نستهلك ذاكرة ضخمة على الآيفون.
  */

  for (
    let i = 0;
    i < selectedFiles.length;
    i++
  ) {
    const file = selectedFiles[i];

    setStatus(
      `جاري تجهيز الملصق ${i + 1} من ${selectedFiles.length}...`
    );

    if (isGIF(file)) {
      /*
        GIF يحتاج Encoder متحرك WebP.
        لا نحاول تحويله بمكتبة wasm-webp
        التي سببت الخطأ في النسخة السابقة.
      */

      await prepareGIF(file);

      outputFiles.push({
        original: file,
        output: file,
        animated: true
      });
    } else {
      const webpFile =
        await createStaticSticker(file);

      outputFiles.push({
        original: file,
        output: webpFile,
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
   زر إنشاء الحزمة
========================= */

createButton.addEventListener(
  "click",
  async () => {
    if (
      selectedFiles.length < MIN_STICKERS
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
        "جاري تجهيز حزمة الملصقات..."
      );

      const result =
        await createStickerPack();

      generatedFiles =
        result.files;

      const staticCount =
        generatedFiles.filter(
          item => !item.animated
        ).length;

      const gifCount =
        generatedFiles.filter(
          item => item.animated
        ).length;

      setStatus(
        `تم تجهيز ${generatedFiles.length} ملصق: ${staticCount} صورة و${gifCount} GIF.`
      );

      setBridgeStatus(
        "تم تجهيز الملفات بنجاح."
      );

      /*
        نفعّل زر المشاركة مؤقتًا فقط
        عندما تكون الملفات جاهزة.
      */

      whatsappButton.disabled = false;

    } catch (error) {
      console.error(
        "خطأ أثناء إنشاء الحزمة:",
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
      createButton.disabled = false;
    }
  }
);

/* =========================
   مشاركة الملفات
========================= */

whatsappButton.addEventListener(
  "click",
  async () => {
    if (!generatedFiles.length) {
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
        navigator.canShare
      ) {
        const shareData = {
          files,
          title: "Miku Stickers",
          text: "ملصقات Miku"
        };

        if (
          navigator.canShare({
            files
          })
        ) {
          await navigator.share(
            shareData
          );

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
        "جرّب Safari أو متصفحًا يدعم مشاركة الملفات."
      );

    } catch (error) {
      if (
        error?.name === "AbortError"
      ) {
        setStatus(
          "تم إلغاء المشاركة."
        );

        return;
      }

      console.error(
        "خطأ في المشاركة:",
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
