import { encode as encodeWebP } from
  "https://esm.sh/@jsquash/webp@1.5.0";

import {
  parseGIF,
  decompressFrames
} from "https://esm.sh/gifuct-js@2.1.2";

import WebPMuxer from
  "https://esm.sh/webp-muxer@4.0.2";

const MAX_STATIC_SIZE = 100 * 1024;
const MAX_ANIMATED_SIZE = 500 * 1024;
const STICKER_SIZE = 512;
const MAX_GIF_DURATION = 10000;

const fileInput = document.getElementById("fileInput");
const packNameInput = document.getElementById("packName");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const createButton = document.getElementById("createButton");
const whatsappButton = document.getElementById("whatsappButton");
const bridgeStatus = document.getElementById("bridgeStatus");

let selectedFiles = [];
let generatedPackFile = null;

/* =========================
   Helpers
========================= */

function isGif(file) {
  return (
    file.type === "image/gif" ||
    file.name.toLowerCase().endsWith(".gif")
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setStatus(message) {
  status.textContent = message;
}

function setBridge(message) {
  bridgeStatus.textContent = message;
}

function arrayBufferFrom(value) {
  if (value instanceof ArrayBuffer) return value;
  if (value instanceof Uint8Array) return value.buffer;
  if (value?.buffer instanceof ArrayBuffer) {
    return value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength
    );
  }
  throw new Error("صيغة بيانات WebP غير معروفة.");
}

function uint8From(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value?.buffer instanceof ArrayBuffer) {
    return new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength
    );
  }
  throw new Error("صيغة البيانات غير معروفة.");
}

function fileFromBytes(bytes, name, type) {
  return new File([bytes], name, { type });
}

/* =========================
   Image loading
========================= */

async function loadImage(file) {
  const url = URL.createObjectURL(file);

  try {
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(
        new Error(`تعذر قراءة الصورة: ${file.name}`)
      );
      img.src = url;
    });

    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* =========================
   Trim transparent edges
========================= */

function getAlphaBounds(imageData) {
  const { data, width, height } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  // أي ألفا أكبر من 5 يعتبر محتوى.
  const alphaThreshold = 5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];

      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

/* =========================
   Crop + cover
========================= */

function cropAndCoverTo512(sourceCanvas, bounds = null) {
  const output = document.createElement("canvas");
  output.width = STICKER_SIZE;
  output.height = STICKER_SIZE;

  const ctx = output.getContext("2d", { alpha: true });

  ctx.clearRect(0, 0, STICKER_SIZE, STICKER_SIZE);

  let sx = 0;
  let sy = 0;
  let sw = sourceCanvas.width;
  let sh = sourceCanvas.height;

  if (bounds) {
    sx = bounds.x;
    sy = bounds.y;
    sw = bounds.width;
    sh = bounds.height;
  }

  // مثل object-fit: cover
  const scale = Math.max(
    STICKER_SIZE / sw,
    STICKER_SIZE / sh
  );

  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);

  const dx = Math.round((STICKER_SIZE - dw) / 2);
  const dy = Math.round((STICKER_SIZE - dh) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    sourceCanvas,
    sx,
    sy,
    sw,
    sh,
    dx,
    dy,
    dw,
    dh
  );

  return ctx.getImageData(
    0,
    0,
    STICKER_SIZE,
    STICKER_SIZE
  );
}

/* =========================
   Static image → ImageData
========================= */

async function imageToStickerImageData(file) {
  const img = await loadImage(file);

  const source = document.createElement("canvas");

  source.width = img.naturalWidth;
  source.height = img.naturalHeight;

  const ctx = source.getContext("2d", { alpha: true });

  ctx.clearRect(
    0,
    0,
    source.width,
    source.height
  );

  ctx.drawImage(
    img,
    0,
    0,
    source.width,
    source.height
  );

  const originalData = ctx.getImageData(
    0,
    0,
    source.width,
    source.height
  );

  // إزالة الفراغات الشفافة أولًا.
  const bounds = getAlphaBounds(originalData);

  return cropAndCoverTo512(source, bounds);
}

/* =========================
   Static WebP compression
========================= */

async function encodeStaticWebP(imageData) {
  let bestResult = null;

  // نبدأ بجودة عالية ثم ننزل تدريجيًا.
  const qualities = [
    90,
    82,
    75,
    68,
    60,
    52,
    45,
    38,
    32,
    26,
    20,
    15,
    10
  ];

  for (const quality of qualities) {
    const encoded = await encodeWebP(imageData, {
      quality,
      method: 4
    });

    const bytes = uint8From(encoded);

    bestResult = bytes;

    if (bytes.byteLength <= MAX_STATIC_SIZE) {
      return bytes;
    }
  }

  throw new Error(
    `ما قدرنا نضغط الصورة إلى أقل من 100KB (${Math.round(
      bestResult.byteLength / 1024
    )}KB).`
  );
}

/* =========================
   GIF decoding
========================= */

async function decodeGif(file) {
  const buffer = await file.arrayBuffer();

  const gif = parseGIF(buffer);

  const frames = decompressFrames(
    gif,
    true
  );

  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error("تعذر استخراج فريمات GIF.");
  }

  return {
    gif,
    frames
  };
}

/* =========================
   GIF frame compositing
========================= */

function renderGifFrames(gif, frames) {
  const width = gif.lsd.width;
  const height = gif.lsd.height;

  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", {
    alpha: true
  });

  ctx.clearRect(0, 0, width, height);

  const results = [];

  let previousFrame = null;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    const before = document.createElement("canvas");
    before.width = width;
    before.height = height;

    const beforeCtx = before.getContext("2d", {
      alpha: true
    });

    beforeCtx.drawImage(canvas, 0, 0);

    const patch = new ImageData(
      new Uint8ClampedArray(frame.patch),
      frame.dims.width,
      frame.dims.height
    );

    ctx.putImageData(
      patch,
      frame.dims.left,
      frame.dims.top
    );

    const fullFrame = document.createElement("canvas");
    fullFrame.width = width;
    fullFrame.height = height;

    const fullCtx = fullFrame.getContext("2d", {
      alpha: true
    });

    fullCtx.drawImage(canvas, 0, 0);

    results.push({
      canvas: fullFrame,
      delay: Math.max(
        20,
        Number(frame.delay || 100)
      ),
      disposalType: Number(
        frame.disposalType || 0
      )
    });

    /*
      GIF disposal:
      2 = restore to background.
      3 = restore to previous.
    */
    if (frame.disposalType === 2) {
      ctx.clearRect(
        frame.dims.left,
        frame.dims.top,
        frame.dims.width,
        frame.dims.height
      );
    } else if (frame.disposalType === 3) {
      ctx.clearRect(0, 0, width, height);

      if (previousFrame) {
        ctx.drawImage(
          previousFrame,
          0,
          0
        );
      }
    }

    previousFrame = before;
  }

  return results;
}

/* =========================
   GIF frame → sticker ImageData
========================= */

function canvasToStickerImageData(sourceCanvas) {
  const ctx = sourceCanvas.getContext("2d", {
    alpha: true
  });

  const sourceData = ctx.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );

  const bounds = getAlphaBounds(sourceData);

  return cropAndCoverTo512(
    sourceCanvas,
    bounds
  );
}

/* =========================
   Encode Animated WebP
========================= */

async function encodeAnimatedWebP(frameData) {
  if (!frameData.length) {
    throw new Error("لا توجد فريمات GIF.");
  }

  /*
    webp-muxer يحتاج WebP chunks لكل فريم.
    كل فريم يتم ترميزه كـ WebP منفصل ثم يتم تجميعه
    في Animated WebP.
  */

  const encodedFrames = [];

  let totalDuration = 0;

  for (let i = 0; i < frameData.length; i++) {
    const frame = frameData[i];

    const encoded = await encodeWebP(
      frame.imageData,
      {
        quality: 65,
        method: 4
      }
    );

    const bytes = uint8From(encoded);

    encodedFrames.push({
      bytes,
      duration: frame.delay
    });

    totalDuration += frame.delay;

    if (totalDuration >= MAX_GIF_DURATION) {
      break;
    }
  }

  /*
    webp-muxer API.
    إذا اختلف شكل التصدير في إصدار CDN،
    يظهر الخطأ بدل إنتاج ملف تالف.
  */

  const muxer = new WebPMuxer({
    width: STICKER_SIZE,
    height: STICKER_SIZE,
    loopCount: 0
  });

  for (const frame of encodedFrames) {
    muxer.addFrame(
      frame.bytes,
      frame.duration
    );
  }

  const output = muxer.finalize();

  return uint8From(output);
}

/* =========================
   GIF → Animated WebP
========================= */

async function createAnimatedSticker(file) {
  const { gif, frames } = await decodeGif(file);

  let totalDuration = 0;

  const rendered = renderGifFrames(
    gif,
    frames
  );

  const frameData = [];

  for (const frame of rendered) {
    let delay = clamp(
      Number(frame.delay || 100),
      20,
      1000
    );

    if (totalDuration + delay > MAX_GIF_DURATION) {
      delay =
        MAX_GIF_DURATION -
        totalDuration;
    }

    if (delay <= 0) break;

    const imageData =
      canvasToStickerImageData(
        frame.canvas
      );

    frameData.push({
      imageData,
      delay
    });

    totalDuration += delay;

    if (totalDuration >= MAX_GIF_DURATION) {
      break;
    }
  }

  if (!frameData.length) {
    throw new Error(
      "تعذر تجهيز فريمات GIF."
    );
  }

  let result =
    await encodeAnimatedWebP(
      frameData
    );

  /*
    محاولة تخفيض الجودة إذا تجاوز
    الحد المطلوب للملصق المتحرك.
  */

  if (result.byteLength > MAX_ANIMATED_SIZE) {
    const qualityLevels = [
      50,
      40,
      30,
      20
    ];

    for (const quality of qualityLevels) {
      const encodedFrames = [];

      for (const frame of frameData) {
        const encoded =
          await encodeWebP(
            frame.imageData,
            {
              quality,
              method: 4
            }
          );

        encodedFrames.push({
          bytes: uint8From(encoded),
          duration: frame.delay
        });
      }

      const muxer =
        new WebPMuxer({
          width: STICKER_SIZE,
          height: STICKER_SIZE,
          loopCount: 0
        });

      for (const frame of encodedFrames) {
        muxer.addFrame(
          frame.bytes,
          frame.duration
        );
      }

      result = uint8From(
        muxer.finalize()
      );

      if (
        result.byteLength <=
        MAX_ANIMATED_SIZE
      ) {
        break;
      }
    }
  }

  if (
    result.byteLength >
    MAX_ANIMATED_SIZE
  ) {
    throw new Error(
      `حجم GIF بعد التحويل صار ${Math.round(
        result.byteLength / 1024
      )}KB، وهو أكبر من 500KB.`
    );
  }

  return result;
}

/* =========================
   Preview
========================= */

function clearPreview() {
  preview.innerHTML = "";
}

function addPreview(file, index) {
  const card =
    document.createElement("div");

  card.className = "sticker-card";

  const img =
    document.createElement("img");

  img.alt = `ملصق ${index + 1}`;

  const number =
    document.createElement("div");

  number.className =
    "sticker-number";

  number.textContent =
    index + 1;

  const size =
    document.createElement("div");

  size.className =
    "sticker-size";

  size.textContent =
    `${Math.round(file.size / 1024)}KB`;

  const url =
    URL.createObjectURL(file);

  img.src = url;

  img.onload = () => {
    URL.revokeObjectURL(url);
  };

  card.appendChild(img);
  card.appendChild(number);
  card.appendChild(size);

  preview.appendChild(card);
}

function updatePreview() {
  clearPreview();

  selectedFiles.forEach(
    (file, index) => {
      addPreview(
        file,
        index
      );
    }
  );
}

/* =========================
   File selection
========================= */

fileInput.addEventListener(
  "change",
  () => {
    generatedPackFile = null;

    whatsappButton.disabled = true;

    const files =
      Array.from(fileInput.files || []);

    if (
      files.length < 3 ||
      files.length > 30
    ) {
      selectedFiles = [];

      clearPreview();

      createButton.disabled = true;

      setStatus(
        "اختر من 3 إلى 30 ملف."
      );

      return;
    }

    const invalid =
      files.find(
        file =>
          !isStaticImage(file) &&
          !isGif(file)
      );

    if (invalid) {
      selectedFiles = [];

      clearPreview();

      createButton.disabled = true;

      setStatus(
        `نوع الملف غير مدعوم: ${invalid.name}`
      );

      return;
    }

    selectedFiles = files;

    updatePreview();

    createButton.disabled = false;

    setStatus(
      `تم اختيار ${files.length} ملف.`
    );

    setBridge(
      "جاهز لإنشاء حزمة الملصقات."
    );
  }
);

/* =========================
   Cover
========================= */

async function createCover(file) {
  if (isGif(file)) {
    const { gif, frames } =
      await decodeGif(file);

    const rendered =
      renderGifFrames(
        gif,
        frames
      );

    if (rendered.length) {
      const imageData =
        canvasToStickerImageData(
          rendered[0].canvas
        );

      const canvas =
        document.createElement("canvas");

      canvas.width = 96;
      canvas.height = 96;

      const ctx =
        canvas.getContext("2d");

      const temp =
        document.createElement("canvas");

      temp.width = 512;
      temp.height = 512;

      temp
        .getContext("2d")
        .putImageData(
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
        resolve =>
          canvas.toBlob(
            resolve,
            "image/png"
          )
      );
    }
  }

  const imageData =
    await imageToStickerImageData(
      file
    );

  const canvas =
    document.createElement("canvas");

  canvas.width = 96;
  canvas.height = 96;

  const temp =
    document.createElement("canvas");

  temp.width = 512;
  temp.height = 512;

  temp
    .getContext("2d")
    .putImageData(
      imageData,
      0,
      0
    );

  canvas
    .getContext("2d")
    .drawImage(
      temp,
      0,
      0,
      96,
      96
    );

  return new Promise(
    resolve =>
      canvas.toBlob(
        resolve,
        "image/png"
      )
  );
}

/* =========================
   Create pack
========================= */

createButton.addEventListener(
  "click",
  async () => {
    if (
      selectedFiles.length < 3 ||
      selectedFiles.length > 30
    ) {
      return;
    }

    createButton.disabled = true;
    whatsappButton.disabled = true;

    generatedPackFile = null;

    try {
      const packName =
        (
          packNameInput.value.trim() ||
          "Miku Stickers"
        ).slice(0, 128);

      setStatus(
        "جاري تجهيز الملصقات..."
      );

      const stickerFiles = [];

      for (
        let i = 0;
        i < selectedFiles.length;
        i++
      ) {
        const file =
          selectedFiles[i];

        setStatus(
          `جاري تحويل الملصق ${i + 1} من ${selectedFiles.length}...`
        );

        if (isGif(file)) {
          const bytes =
            await createAnimatedSticker(
              file
            );

          stickerFiles.push({
            bytes,
            name:
              `sticker_${String(
                i + 1
              ).padStart(2, "0")}.webp`,
            animated: true
          });
        } else {
          const imageData =
            await imageToStickerImageData(
              file
            );

          const bytes =
            await encodeStaticWebP(
              imageData
            );

          stickerFiles.push({
            bytes,
            name:
              `sticker_${String(
                i + 1
              ).padStart(2, "0")}.webp`,
            animated: false
          });
        }
      }

      setStatus(
        "جاري بناء حزمة .wastickers..."
      );

      const cover =
        await createCover(
          selectedFiles[0]
        );

      const zip =
        new JSZip();

      zip.file(
        "author.txt",
        "Miku Stickers"
      );

      zip.file(
        "title.txt",
        packName
      );

      zip.file(
        "cover.png",
        await cover.arrayBuffer()
      );

      for (
        const sticker of stickerFiles
      ) {
        zip.file(
          sticker.name,
          sticker.bytes
        );
      }

      const manifest = {
        title: packName,
        author: "Miku Stickers",
        stickers:
          stickerFiles.map(
            sticker => ({
              file: sticker.name,
              animated:
                sticker.animated
            })
          )
      };

      zip.file(
        "sticker_packs.json",
        JSON.stringify(
          manifest,
          null,
          2
        )
      );

      const blob =
        await zip.generateAsync({
          type: "blob",
          mimeType:
            "application/octet-stream",
          compression: "STORE"
        });

      generatedPackFile =
        new File(
          [blob],
          `${packName}.wastickers`,
          {
            type:
              "application/octet-stream"
          }
        );

      setStatus(
        `تم إنشاء الحزمة بنجاح — ${Math.round(
          blob.size / 1024
        )}KB`
      );

      setBridge(
        "الحزمة جاهزة. اضغط مشاركة الحزمة إلى Sticker Maker."
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
        "حدث خطأ أثناء إنشاء الحزمة."
      );

      setBridge(
        "تعذر إنشاء الحزمة."
      );

    } finally {
      createButton.disabled =
        false;
    }
  }
);

/* =========================
   Share to Sticker Maker
========================= */

whatsappButton.addEventListener(
  "click",
  async () => {
    if (!generatedPackFile) {
      return;
    }

    try {
      if (
        !navigator.share ||
        !navigator.canShare ||
        !navigator.canShare({
          files: [
            generatedPackFile
          ]
        })
      ) {
        setBridge(
          "المتصفح لا يدعم مشاركة الملفات من هنا."
        );
        return;
      }

      await navigator.share({
        files: [
          generatedPackFile
        ],
        title:
          generatedPackFile.name,
        text:
          "Miku Stickers"
      });

      setBridge(
        "تم فتح قائمة المشاركة."
      );

    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        setBridge(
          "تم إلغاء المشاركة."
        );
      } else {
        console.error(
          error
        );

        setBridge(
          "تعذر فتح المشاركة."
        );
      }
    }
  }
);
