"use strict";

/*
==================================================
 MIKU STICKERS
 تحويل الصور إلى WebP ثم إنشاء .wastickers
==================================================
*/

import { encode as encodeWebP } from
  "https://esm.sh/@jsquash/webp@1.5.0";


/* ==================================================
   العناصر
================================================== */

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


/* ==================================================
   الإعدادات
================================================== */

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;

const MAX_STATIC_SIZE =
  100 * 1024;

const STICKER_SIZE = 512;

let selectedFiles = [];

let generatedPackBlob = null;

let generatedPackFile = null;


/* ==================================================
   الحالة
================================================== */

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


/* ==================================================
   حجم الملفات
================================================== */

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


/* ==================================================
   أنواع الملفات
================================================== */

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


/* ==================================================
   معاينة الملفات
================================================== */

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
        ? "GIF"
        : "صورة";


    const url =
      URL.createObjectURL(file);

    img.src = url;

    img.alt =
      `ملصق ${index + 1}`;


    img.onload = () => {

      if (!isGIF(file)) {
        URL.revokeObjectURL(url);
      }

    };


    img.onerror = () => {

      URL.revokeObjectURL(url);

    };


    card.appendChild(img);
    card.appendChild(number);
    card.appendChild(size);
    card.appendChild(type);

    preview.appendChild(card);

  });
}


/* ==================================================
   اختيار الملفات
================================================== */

fileInput.addEventListener(
  "change",
  () => {

    const files =
      Array.from(
        fileInput.files || []
      );


    selectedFiles = [];

    generatedPackBlob = null;
    generatedPackFile = null;

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
      files.length < MIN_STICKERS ||
      files.length > MAX_STICKERS
    ) {

      preview.innerHTML = "";

      createButton.disabled =
        true;

      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملفات. تم اختيار ${files.length}.`
      );

      return;
    }


    const unsupported =
      files.filter(
        file => !isSupported(file)
      );


    if (unsupported.length) {

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


    setStatus(
      `تم اختيار ${files.length} ملف: ${imageCount} صورة و${gifCount} GIF.`
    );


    setBridgeStatus(
      "الملفات جاهزة لإنشاء الحزمة."
    );

  }
);


/* ==================================================
   قراءة الصورة
================================================== */

function loadImage(file) {

  return new Promise(
    (resolve, reject) => {

      const img =
        new Image();

      const url =
        URL.createObjectURL(file);


      img.onload = () => {

        URL.revokeObjectURL(url);

        resolve(img);

      };


      img.onerror = () => {

        URL.revokeObjectURL(url);

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


/* ==================================================
   تحويل الصورة إلى ImageData
   512 × 512
================================================== */

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


  if (!ctx) {
    throw new Error(
      "تعذر إنشاء Canvas."
    );
  }


  ctx.clearRect(
    0,
    0,
    STICKER_SIZE,
    STICKER_SIZE
  );


  /*
   * نحافظ على نسبة أبعاد الصورة.
   */

  const scale =
    Math.min(
      STICKER_SIZE / img.width,
      STICKER_SIZE / img.height
    );


  const width =
    Math.round(
      img.width *
      scale *
      contentScale
    );


  const height =
    Math.round(
      img.height *
      scale *
      contentScale
    );


  const x =
    Math.round(
      (STICKER_SIZE - width) / 2
    );


  const y =
    Math.round(
      (STICKER_SIZE - height) / 2
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
    STICKER_SIZE,
    STICKER_SIZE
  );
}


/* ==================================================
   ضغط WebP باستخدام jsquash
================================================== */

async function encodeImageData(
  imageData,
  quality
) {

  const result =
    await encodeWebP(
      imageData,
      {
        quality,
        method: 4
      }
    );


  let buffer;


  if (
    result instanceof Uint8Array
  ) {

    buffer =
      result;

  } else if (
    result instanceof ArrayBuffer
  ) {

    buffer =
      new Uint8Array(result);

  } else {

    throw new Error(
      "مكتبة WebP لم تُرجع بيانات صحيحة."
    );

  }


  if (!buffer.length) {

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


/* ==================================================
   إنشاء ملصق ثابت
   الهدف: <=100KB
================================================== */

async function createStaticSticker(
  file,
  index,
  total
) {

  let quality = 80;

  let contentScale = 1;


  for (
    let attempt = 0;
    attempt < 40;
    attempt++
  ) {

    setStatus(
      `جاري تحويل الملصق ${index} من ${total}...`
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


    if (
      blob.size <=
      MAX_STATIC_SIZE
    ) {

      return new File(
        [blob],
        `sticker_${String(index).padStart(2, "0")}.webp`,
        {
          type: "image/webp"
        }
      );

    }


    /*
     * ننزل الجودة تدريجيًا.
     */

    if (quality > 30) {

      quality -= 5;

      continue;
    }


    /*
     * إذا لم تكفِ الجودة،
     * نصغر محتوى الصورة داخل
     * Canvas 512×512.
     */

    if (contentScale > 0.45) {

      contentScale -= 0.05;

      quality = 55;

      continue;
    }


    break;

  }


  throw new Error(
    `${file.name} لم نستطع ضغطه إلى أقل من 100KB.`
  );
}


/* ==================================================
   إنشاء Cover 96×96
================================================== */

async function createCover(
  sourceFile
) {

  const imageData =
    await imageToImageData(
      sourceFile,
      1
    );


  const sourceCanvas =
    document.createElement(
      "canvas"
    );


  sourceCanvas.width =
    512;

  sourceCanvas.height =
    512;


  const sourceCtx =
    sourceCanvas.getContext(
      "2d"
    );


  sourceCtx.putImageData(
    imageData,
    0,
    0
  );


  const coverCanvas =
    document.createElement(
      "canvas"
    );


  coverCanvas.width = 96;
  coverCanvas.height = 96;


  const coverCtx =
    coverCanvas.getContext(
      "2d"
    );


  coverCtx.drawImage(
    sourceCanvas,
    0,
    0,
    96,
    96
  );


  const blob =
    await new Promise(
      (resolve, reject) => {

        coverCanvas.toBlob(
          result => {

            if (!result) {

              reject(
                new Error(
                  "تعذر إنشاء صورة الغلاف."
                )
              );

              return;
            }

            resolve(result);

          },
          "image/png"
        );

      }
    );


  return new File(
    [blob],
    "cover.png",
    {
      type: "image/png"
    }
  );
}


/* ==================================================
   تنظيف اسم الحزمة
================================================== */

function getPackName() {

  const value =
    packNameInput?.value.trim();


  if (!value) {
    return "Miku Stickers";
  }


  return value.slice(
    0,
    128
  );
}


/* ==================================================
   إنشاء ID للحزمة
================================================== */

function createPackIdentifier() {

  return (
    "miku_stickers_" +
    Date.now()
  );

}


/* ==================================================
   إنشاء ملف .wastickers
================================================== */

async function buildWastickersPack() {

  /*
   * JSZip موجود في index.html
   */

  if (
    typeof JSZip ===
    "undefined"
  ) {

    throw new Error(
      "JSZip غير محمل."
    );

  }


  if (
    selectedFiles.length <
      MIN_STICKERS ||
    selectedFiles.length >
      MAX_STICKERS
  ) {

    throw new Error(
      `يجب اختيار من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملصقات.`
    );

  }


  /*
   * لا نسمح بـGIF حاليًا لأن
   * GIF نفسه ليس Animated WebP.
   */

  const gifs =
    selectedFiles.filter(
      file => isGIF(file)
    );


  if (gifs.length) {

    throw new Error(
      "ملفات GIF تحتاج تحويلها إلى Animated WebP أولًا. الصور الثابتة فقط متاحة في إصدار إنشاء الحزمة الحالي."
    );

  }


  const zip =
    new JSZip();


  const packName =
    getPackName();


  const identifier =
    createPackIdentifier();


  /*
   * author.txt
   */

  zip.file(
    "author.txt",
    "Miku Stickers"
  );


  /*
   * title.txt
   */

  zip.file(
    "title.txt",
    packName
  );


  /*
   * تحويل الصور
   */

  const stickerFiles = [];


  for (
    let i = 0;
    i < selectedFiles.length;
    i++
  ) {

    const file =
      selectedFiles[i];


    const sticker =
      await createStaticSticker(
        file,
        i + 1,
        selectedFiles.length
      );


    stickerFiles.push(
      sticker
    );


    /*
     * نضع WebP داخل ZIP
     */

    const arrayBuffer =
      await sticker.arrayBuffer();


    zip.file(
      sticker.name,
      arrayBuffer
    );

  }


  /*
   * إنشاء الغلاف من أول ملصق.
   */

  setStatus(
    "جاري إنشاء صورة الغلاف..."
  );


  const cover =
    await createCover(
      selectedFiles[0]
    );


  zip.file(
    "cover.png",
    await cover.arrayBuffer()
  );


  /*
   * بعض التطبيقات تستفيد من
   * sticker_packs.json.
   *
   * نضيفه كبيانات وصفية أيضًا.
   */

  const manifest = {

    identifier,

    name:
      packName,

    publisher:
      "Miku Stickers",

    tray_image_file:
      "cover.png",

    stickers:
      stickerFiles.map(
        file => ({
          image_file:
            file.name,

          emojis: []
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


  /*
   * إنشاء ZIP النهائي.
   */

  setStatus(
    "جاري تجميع حزمة .wastickers..."
  );


  const blob =
    await zip.generateAsync(
      {
        type: "blob",
        mimeType:
          "application/octet-stream",
        compression:
          "STORE"
      },
      metadata => {

        const percent =
          Math.round(
            metadata.percent
          );

        setStatus(
          `جاري تجميع الحزمة... ${percent}%`
        );

      }
    );


  /*
   * تغيير MIME إلى نوع عام
   * حتى يتعامل iOS مع الملف
   * كملف قابل للمشاركة.
   */

  generatedPackBlob =
    blob;


  generatedPackFile =
    new File(
      [blob],
      `${packName}.wastickers`,
      {
        type:
          "application/octet-stream"
      }
    );


  return generatedPackFile;
}


/* ==================================================
   زر إنشاء الحزمة
================================================== */

createButton.addEventListener(
  "click",
  async () => {

    if (
      !selectedFiles.length
    ) {

      setStatus(
        "اختر الملصقات أولًا."
      );

      return;
    }


    createButton.disabled =
      true;

    whatsappButton.disabled =
      true;


    try {

      setBridgeStatus(
        "جاري إنشاء حزمة WhatsApp..."
      );


      const pack =
        await buildWastickersPack();


      const size =
        formatBytes(
          pack.size
        );


      setStatus(
        `تم إنشاء الحزمة بنجاح: ${pack.name} (${size})`
      );


      setBridgeStatus(
        "الحزمة جاهزة للمشاركة إلى Sticker Maker."
      );


      whatsappButton.disabled =
        false;


    } catch (error) {

      console.error(
        "WASTICKERS ERROR:",
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


/* ==================================================
   مشاركة ملف .wastickers
================================================== */

whatsappButton.addEventListener(
  "click",
  async () => {

    if (
      !generatedPackFile
    ) {

      setStatus(
        "أنشئ الحزمة أولًا."
      );

      return;
    }


    try {

      /*
       * Web Share API
       */

      if (
        navigator.share &&
        navigator.canShare
      ) {

        const shareData = {
          files: [
            generatedPackFile
          ],
          title:
            generatedPackFile.name,
          text:
            "Miku Stickers"
        };


        if (
          navigator.canShare(
            shareData
          )
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


      /*
       * إذا لم يدعم المتصفح
       * مشاركة الملفات، ننزل الملف.
       */

      const url =
        URL.createObjectURL(
          generatedPackFile
        );


      const a =
        document.createElement(
          "a"
        );


      a.href = url;

      a.download =
        generatedPackFile.name;


      document.body.appendChild(a);

      a.click();

      a.remove();


      setTimeout(
        () => {
          URL.revokeObjectURL(url);
        },
        1000
      );


      setStatus(
        "تم تجهيز ملف .wastickers."
      );


      setBridgeStatus(
        "افتح الملف باستخدام Sticker Maker."
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
        "SHARE ERROR:",
        error
      );


      setStatus(
        "تعذر مشاركة الحزمة."
      );

    }

  }
);


/* ==================================================
   الحالة الابتدائية
================================================== */

createButton.disabled =
  true;

whatsappButton.disabled =
  true;


setStatus(
  "اختر من 3 إلى 30 صورة."
);


setBridgeStatus(
  "Miku Stickers جاهز."
);
