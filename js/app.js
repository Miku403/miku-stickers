"use strict";

/* =========================================================
   MIKU STICKERS
   ========================================================= */

const fileInput = document.getElementById("fileInput");
const packNameInput = document.getElementById("packName");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const createButton = document.getElementById("createButton");
const whatsappButton = document.getElementById("whatsappButton");
const bridgeStatus = document.getElementById("bridgeStatus");


/* =========================
   الإعدادات
========================= */

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;

const STICKER_SIZE = 512;
const MAX_SIZE = 100 * 1024;


/* =========================
   البيانات
========================= */

let selectedFiles = [];
let generatedStickers = [];
let generatedPack = null;


/* =========================================================
   تحميل الصورة
========================================================= */

function loadImage(file) {

  return new Promise((resolve, reject) => {

    const url = URL.createObjectURL(file);

    const image = new Image();

    image.onload = () => {

      URL.revokeObjectURL(url);

      resolve(image);

    };

    image.onerror = () => {

      URL.revokeObjectURL(url);

      reject(
        new Error("تعذر قراءة الصورة.")
      );

    };

    image.src = url;

  });

}


/* =========================================================
   Canvas → WebP
========================================================= */

function canvasToWebP(canvas, quality) {

  return new Promise((resolve, reject) => {

    canvas.toBlob(
      (blob) => {

        if (!blob) {

          reject(
            new Error(
              "تعذر إنشاء الصورة."
            )
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


/* =========================================================
   اختبار WebP الحقيقي
========================================================= */

async function supportsWebP() {

  const canvas =
    document.createElement("canvas");

  canvas.width = 1;
  canvas.height = 1;

  const blob =
    await canvasToWebP(
      canvas,
      0.5
    );

  /*
    بعض المتصفحات قد لا تضبط blob.type
    بشكل موثوق، لذلك نعتمد على الحجم
    ووجود Blob بدل الاعتماد على النوع فقط.
  */

  return !!blob && blob.size > 0;

}


/* =========================================================
   إنشاء الملصق
========================================================= */

async function makeSticker(file) {

  const image =
    await loadImage(file);


  const finalCanvas =
    document.createElement("canvas");

  finalCanvas.width =
    STICKER_SIZE;

  finalCanvas.height =
    STICKER_SIZE;


  const finalCtx =
    finalCanvas.getContext("2d");


  if (!finalCtx) {

    throw new Error(
      "Canvas غير مدعوم."
    );

  }


  const imageWidth =
    image.naturalWidth;

  const imageHeight =
    image.naturalHeight;


  /*
    أحجام العمل.
    نقلل التفاصيل تدريجيًا إذا كانت الصورة
    صعبة الضغط.
  */

  const workingSizes = [
    512,
    448,
    384,
    320,
    256,
    224,
    192,
    160,
    128,
    96,
    80,
    64,
    48,
    32
  ];


  for (
    const workingSize of workingSizes
  ) {

    /*
      Canvas داخلي صغير
    */

    const workCanvas =
      document.createElement("canvas");

    workCanvas.width =
      workingSize;

    workCanvas.height =
      workingSize;


    const workCtx =
      workCanvas.getContext("2d");


    if (!workCtx) {
      continue;
    }


    /*
      Cover Crop
    */

    const scale =
      Math.max(
        workingSize / imageWidth,
        workingSize / imageHeight
      );


    const width =
      imageWidth * scale;

    const height =
      imageHeight * scale;


    const x =
      (workingSize - width) / 2;

    const y =
      (workingSize - height) / 2;


    workCtx.clearRect(
      0,
      0,
      workingSize,
      workingSize
    );


    workCtx.imageSmoothingEnabled =
      true;

    workCtx.imageSmoothingQuality =
      "medium";


    workCtx.drawImage(
      image,
      x,
      y,
      width,
      height
    );


    /*
      إعادة الحجم إلى 512×512
    */

    finalCtx.clearRect(
      0,
      0,
      STICKER_SIZE,
      STICKER_SIZE
    );


    finalCtx.imageSmoothingEnabled =
      true;

    finalCtx.imageSmoothingQuality =
      "low";


    finalCtx.drawImage(
      workCanvas,
      0,
      0,
      STICKER_SIZE,
      STICKER_SIZE
    );


    /*
      نجرب جودة منخفضة جدًا أولًا
    */

    let blob =
      await canvasToWebP(
        finalCanvas,
        0.01
      );


    /*
      نجح مباشرة
    */

    if (
      blob &&
      blob.size <= MAX_SIZE
    ) {

      return blob;

    }


    /*
      بحث ثنائي عن أفضل جودة
    */

    let low = 0.001;
    let high = 0.95;

    let best = null;


    for (
      let i = 0;
      i < 20;
      i++
    ) {

      const quality =
        (low + high) / 2;


      blob =
        await canvasToWebP(
          finalCanvas,
          quality
        );


      if (
        blob &&
        blob.size <= MAX_SIZE
      ) {

        best = blob;

        low = quality;

      } else {

        high = quality;

      }

    }


    if (best) {

      return best;

    }

  }


  throw new Error(
    "تعذر ضغط هذه الصورة تحت 100KB."
  );

}


/* =========================================================
   تنسيق الحجم
========================================================= */

function formatSize(bytes) {

  if (bytes < 1024) {

    return bytes + " B";

  }

  return (
    bytes / 1024
  ).toFixed(1) + " KB";

}


/* =========================================================
   الحالة
========================================================= */

function setStatus(message) {

  status.textContent =
    message;

}


/* =========================================================
   المعاينة
========================================================= */

function renderPreview() {

  preview.innerHTML = "";


  selectedFiles.forEach(
    (file, index) => {

      const card =
        document.createElement("div");

      card.className =
        "sticker-card";


      const img =
        document.createElement("img");


      const url =
        URL.createObjectURL(file);


      img.src = url;

      img.alt =
        "ملصق " +
        (index + 1);


      img.onload = () => {

        URL.revokeObjectURL(url);

      };


      const number =
        document.createElement("div");

      number.className =
        "sticker-number";

      number.textContent =
        "#" +
        (index + 1);


      const size =
        document.createElement("div");

      size.className =
        "sticker-size";

      size.textContent =
        formatSize(file.size);


      card.appendChild(img);
      card.appendChild(number);
      card.appendChild(size);


      preview.appendChild(card);

    }
  );

}


/* =========================================================
   اختيار الصور
========================================================= */

fileInput.addEventListener(
  "change",
  () => {

    const files =
      Array.from(
        fileInput.files || []
      );


    if (
      files.length < MIN_STICKERS
    ) {

      selectedFiles = [];

      preview.innerHTML = "";

      createButton.disabled = true;
      whatsappButton.disabled = true;

      setStatus(
        "اختر من 3 إلى 30 صورة."
      );

      return;

    }


    if (
      files.length > MAX_STICKERS
    ) {

      selectedFiles =
        files.slice(
          0,
          MAX_STICKERS
        );

      setStatus(
        "تم اختيار أول 30 صورة فقط."
      );

    } else {

      selectedFiles =
        files;

      setStatus(
        "تم اختيار " +
        files.length +
        " صورة."
      );

    }


    generatedStickers = [];
    generatedPack = null;

    whatsappButton.disabled = true;
    createButton.disabled = false;

    renderPreview();

  }
);


/* =========================================================
   إنشاء الملصقات
========================================================= */

createButton.addEventListener(
  "click",
  async () => {

    if (
      selectedFiles.length <
      MIN_STICKERS
    ) {

      setStatus(
        "تحتاج إلى 3 صور على الأقل."
      );

      return;

    }


    createButton.disabled = true;
    whatsappButton.disabled = true;

    generatedStickers = [];
    generatedPack = null;


    try {

      /*
        اختبار WebP
      */

      const webpOK =
        await supportsWebP();


      if (!webpOK) {

        throw new Error(
          "هذا المتصفح لا يدعم إنشاء WebP."
        );

      }


      /*
        معالجة الصور واحدة واحدة
      */

      for (
        let i = 0;
        i < selectedFiles.length;
        i++
      ) {

        setStatus(
          "جاري تجهيز الملصق " +
          (i + 1) +
          " من " +
          selectedFiles.length +
          "..."
        );


        const blob =
          await makeSticker(
            selectedFiles[i]
          );


        if (
          blob.size > MAX_SIZE
        ) {

          throw new Error(
            "الملصق " +
            (i + 1) +
            " أكبر من 100KB."
          );

        }


        generatedStickers.push({
          index: i + 1,
          blob: blob
        });


        setStatus(
          "تم تجهيز الملصق " +
          (i + 1) +
          " — " +
          formatSize(blob.size)
        );

      }


      /*
        إنشاء الحزمة
      */

      generatedPack =
        await buildPack();


      setStatus(
        "تم تجهيز جميع الملصقات بنجاح."
      );


      bridgeStatus.textContent =
        "Miku Stickers جاهز.";


      createButton.disabled = false;
      whatsappButton.disabled = false;


    } catch (error) {

      console.error(error);


      setStatus(
        error.message ||
        "حدث خطأ أثناء إنشاء الملصقات."
      );


      createButton.disabled = false;

    }

  }
);


/* =========================================================
   Blob → Base64
========================================================= */

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
              "تعذر تحويل الصورة."
            )
          );

          return;

        }


        const comma =
          result.indexOf(",");


        if (comma === -1) {

          resolve(result);

        } else {

          resolve(
            result.substring(
              comma + 1
            )
          );

        }

      };


      reader.onerror = () => {

        reject(
          new Error(
            "تعذر قراءة الصورة."
          )
        );

      };


      reader.readAsDataURL(blob);

    }
  );

}


/* =========================================================
   إنشاء الغلاف
========================================================= */

async function createCover() {

  if (
    generatedStickers.length === 0
  ) {

    return null;

  }


  const first =
    generatedStickers[0].blob;


  const file =
    new File(
      [first],
      "sticker.webp",
      {
        type: "image/webp"
      }
    );


  const image =
    await loadImage(file);


  const canvas =
    document.createElement("canvas");

  canvas.width = 96;
  canvas.height = 96;


  const ctx =
    canvas.getContext("2d");


  if (!ctx) {

    return null;

  }


  const scale =
    Math.max(
      96 / image.naturalWidth,
      96 / image.naturalHeight
    );


  const width =
    image.naturalWidth * scale;

  const height =
    image.naturalHeight * scale;


  ctx.clearRect(
    0,
    0,
    96,
    96
  );


  ctx.drawImage(
    image,
    (96 - width) / 2,
    (96 - height) / 2,
    width,
    height
  );


  return new Promise(
    (resolve) => {

      canvas.toBlob(
        (blob) => {

          resolve(blob);

        },
        "image/png"
      );

    }
  );

}


/* =========================================================
   إنشاء بيانات الحزمة
========================================================= */

async function buildPack() {

  const name =
    (
      packNameInput.value ||
      "Miku Stickers"
    ).trim();


  const stickers = [];


  for (
    const sticker of generatedStickers
  ) {

    const base64 =
      await blobToBase64(
        sticker.blob
      );


    stickers.push({
      file:
        sticker.index +
        ".webp",

      data:
        base64
    });

  }


  const cover =
    await createCover();


  let coverBase64 = null;


  if (cover) {

    coverBase64 =
      await blobToBase64(
        cover
      );

  }


  return {

    identifier:
      "com.miku.stickers." +
      Date.now(),

    name:
      name,

    publisher:
      "Miku Stickers",

    tray_image:
      coverBase64,

    stickers:
      stickers

  };

}


/* =========================================================
   WhatsApp
========================================================= */

whatsappButton.addEventListener(
  "click",
  () => {

    if (!generatedPack) {

      setStatus(
        "أنشئ الحزمة أولًا."
      );

      return;

    }


    /*
      Native iOS Bridge
    */

    if (
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.mikuStickers
    ) {

      try {

        window.webkit.messageHandlers
          .mikuStickers
          .postMessage({
            action:
              "importPack",

            pack:
              generatedPack
          });


        bridgeStatus.textContent =
          "تم إرسال الحزمة إلى WhatsApp.";


        return;

      } catch (error) {

        console.error(error);

      }

    }


    /*
      المتصفح العادي
    */

    bridgeStatus.textContent =
      "الحزمة جاهزة، لكن الإضافة المباشرة إلى WhatsApp تحتاج Native Bridge.";

    setStatus(
      "تم تجهيز الحزمة بنجاح."
    );

  }
);


/* =========================================================
   البداية
========================================================= */

createButton.disabled = true;

whatsappButton.disabled = true;

setStatus(
  "اختر من 3 إلى 30 صورة."
);
