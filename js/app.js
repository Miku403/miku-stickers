"use strict";

/*
=========================================================
 MIKU STICKERS
 Real WebP Encoder
=========================================================
*/

import { encode } from "https://cdn.jsdelivr.net/npm/@jsquash/webp@1.5.0/+esm";


/* ======================================================
   ELEMENTS
====================================================== */

const fileInput =
  document.getElementById("fileInput");

const packNameInput =
  document.getElementById("packName");

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


/* ======================================================
   SETTINGS
====================================================== */

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;

const STICKER_SIZE = 512;

const MAX_SIZE =
  100 * 1024;


/*
  WebP quality range.

  نبدأ بجودة عالية،
  وإذا تجاوزنا 100KB ننزل تدريجيًا.
*/

const QUALITY_START = 90;
const QUALITY_MIN = 1;


/* ======================================================
   DATA
====================================================== */

let selectedFiles = [];

let generatedStickers = [];

let generatedPack = null;


/* ======================================================
   STATUS
====================================================== */

function setStatus(message) {

  if (status) {
    status.textContent = message;
  }

}


/* ======================================================
   FORMAT SIZE
====================================================== */

function formatSize(bytes) {

  if (bytes < 1024) {

    return `${bytes} B`;

  }

  return (
    bytes / 1024
  ).toFixed(1) + " KB";

}


/* ======================================================
   LOAD IMAGE
====================================================== */

function loadImage(file) {

  return new Promise(
    (resolve, reject) => {

      const url =
        URL.createObjectURL(file);

      const image =
        new Image();

      image.onload = () => {

        URL.revokeObjectURL(url);

        resolve(image);

      };

      image.onerror = () => {

        URL.revokeObjectURL(url);

        reject(
          new Error(
            "تعذر قراءة الصورة."
          )
        );

      };

      image.src = url;

    }
  );

}


/* ======================================================
   CANVAS → RAW RGBA
====================================================== */

function canvasToRGBA(canvas) {

  const ctx =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );


  if (!ctx) {

    throw new Error(
      "تعذر الوصول إلى Canvas."
    );

  }


  return ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

}


/* ======================================================
   REAL WEBP ENCODE
====================================================== */

async function encodeWebP(
  imageData,
  quality
) {

  /*
    @jsquash/webp يستخدم WebAssembly
    ويقوم بإنشاء WebP فعلي.
  */

  const result =
    await encode(
      imageData,
      {
        quality: quality
      }
    );


  /*
    jsquash قد يرجع Uint8Array.
    نحوله إلى Blob.
  */

  const bytes =
    result instanceof Uint8Array
      ? result
      : new Uint8Array(result);


  return new Blob(
    [bytes],
    {
      type: "image/webp"
    }
  );

}


/* ======================================================
   CREATE 512×512 CANVAS
====================================================== */

function createStickerCanvas(
  image,
  workingSize = 512
) {

  /*
    Canvas الداخلي.
  */

  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    workingSize;

  canvas.height =
    workingSize;


  const ctx =
    canvas.getContext("2d");


  if (!ctx) {

    throw new Error(
      "Canvas غير مدعوم."
    );

  }


  /*
    Cover Crop
  */

  const imageWidth =
    image.naturalWidth;

  const imageHeight =
    image.naturalHeight;


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


  /*
    نحافظ على الشفافية.
  */

  ctx.clearRect(
    0,
    0,
    workingSize,
    workingSize
  );


  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    "high";


  ctx.drawImage(
    image,
    x,
    y,
    width,
    height
  );


  return canvas;

}


/* ======================================================
   UPSCALE TO 512×512
====================================================== */

function upscaleTo512(
  sourceCanvas
) {

  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    STICKER_SIZE;

  canvas.height =
    STICKER_SIZE;


  const ctx =
    canvas.getContext("2d");


  if (!ctx) {

    throw new Error(
      "Canvas غير مدعوم."
    );

  }


  ctx.clearRect(
    0,
    0,
    STICKER_SIZE,
    STICKER_SIZE
  );


  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    "low";


  ctx.drawImage(
    sourceCanvas,
    0,
    0,
    STICKER_SIZE,
    STICKER_SIZE
  );


  return canvas;

}


/* ======================================================
   ENCODE WITH QUALITY
====================================================== */

async function encodeCanvas(
  canvas,
  quality
) {

  const imageData =
    canvasToRGBA(
      canvas
    );


  return await encodeWebP(
    imageData,
    quality
  );

}


/* ======================================================
   CREATE STICKER
====================================================== */

async function makeSticker(file) {

  const image =
    await loadImage(file);


  /*
    أحجام العمل.
    إذا كانت الصورة صعبة الضغط،
    نقلل التفاصيل ثم نرجعها إلى 512×512.
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
    128

  ];


  for (
    const workingSize of workingSizes
  ) {

    /*
      إنشاء الصورة الداخلية
    */

    const smallCanvas =
      createStickerCanvas(
        image,
        workingSize
      );


    /*
      الناتج النهائي يجب أن يكون 512×512
    */

    const finalCanvas =
      workingSize === 512
        ? smallCanvas
        : upscaleTo512(
            smallCanvas
          );


    /*
      محاولة بجودة عالية أولًا.
    */

    let blob =
      await encodeCanvas(
        finalCanvas,
        QUALITY_START
      );


    if (
      blob.size <= MAX_SIZE
    ) {

      return blob;

    }


    /*
      Binary Search
      لإيجاد أعلى جودة تحت 100KB.
    */

    let low =
      QUALITY_MIN;

    let high =
      QUALITY_START;

    let best =
      null;


    for (
      let i = 0;
      i < 12;
      i++
    ) {

      const quality =
        Math.floor(
          (low + high) / 2
        );


      blob =
        await encodeCanvas(
          finalCanvas,
          quality
        );


      if (
        blob.size <= MAX_SIZE
      ) {

        best = blob;

        low =
          quality + 1;

      } else {

        high =
          quality - 1;

      }

    }


    /*
      وجدنا جودة مناسبة.
    */

    if (best) {

      return best;

    }

  }


  /*
    محاولة أخيرة بأقل جودة
    وأقل تفاصيل.
  */

  const emergencyCanvas =
    createStickerCanvas(
      image,
      96
    );


  const emergencyFinal =
    upscaleTo512(
      emergencyCanvas
    );


  const emergencyBlob =
    await encodeCanvas(
      emergencyFinal,
      1
    );


  if (
    emergencyBlob.size <=
    MAX_SIZE
  ) {

    return emergencyBlob;

  }


  throw new Error(
    "تعذر ضغط هذه الصورة تحت 100KB."
  );

}


/* ======================================================
   PREVIEW
====================================================== */

function renderPreview() {

  preview.innerHTML = "";


  selectedFiles.forEach(
    (file, index) => {

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


      const url =
        URL.createObjectURL(
          file
        );


      img.src =
        url;


      img.alt =
        `ملصق ${index + 1}`;


      img.onload = () => {

        URL.revokeObjectURL(
          url
        );

      };


      const number =
        document.createElement(
          "div"
        );


      number.className =
        "sticker-number";


      number.textContent =
        "#" +
        (index + 1);


      const size =
        document.createElement(
          "div"
        );


      size.className =
        "sticker-size";


      size.textContent =
        formatSize(
          file.size
        );


      card.appendChild(img);

      card.appendChild(number);

      card.appendChild(size);


      preview.appendChild(card);

    }
  );

}


/* ======================================================
   FILE INPUT
====================================================== */

fileInput.addEventListener(
  "change",
  () => {

    const files =
      Array.from(
        fileInput.files || []
      );


    if (
      files.length <
      MIN_STICKERS
    ) {

      selectedFiles = [];

      generatedStickers = [];

      generatedPack = null;

      preview.innerHTML = "";

      createButton.disabled =
        true;

      whatsappButton.disabled =
        true;

      setStatus(
        "اختر من 3 إلى 30 صورة."
      );

      return;

    }


    if (
      files.length >
      MAX_STICKERS
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


    createButton.disabled =
      false;

    whatsappButton.disabled =
      true;


    renderPreview();

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
      MIN_STICKERS
    ) {

      setStatus(
        "تحتاج إلى 3 صور على الأقل."
      );

      return;

    }


    createButton.disabled =
      true;

    whatsappButton.disabled =
      true;


    generatedStickers = [];

    generatedPack = null;


    try {

      /*
        تجهيز الصور واحدة واحدة
      */

      for (
        let i = 0;
        i < selectedFiles.length;
        i++
      ) {

        setStatus(
          "جاري تحويل الملصق " +
          (i + 1) +
          " من " +
          selectedFiles.length +
          " إلى WebP..."
        );


        const blob =
          await makeSticker(
            selectedFiles[i]
          );


        if (
          blob.size >
          MAX_SIZE
        ) {

          throw new Error(
            "الملصق " +
            (i + 1) +
            " أكبر من 100KB."
          );

        }


        generatedStickers.push({

          index:
            i + 1,

          blob:
            blob

        });


        setStatus(
          "تم تحويل الملصق " +
          (i + 1) +
          " — " +
          formatSize(
            blob.size
          )
        );

      }


      /*
        بناء بيانات الحزمة
      */

      generatedPack =
        await buildPack();


      setStatus(
        "تم تجهيز جميع الملصقات بنجاح."
      );


      bridgeStatus.textContent =
        "Miku Stickers جاهز.";


      createButton.disabled =
        false;

      whatsappButton.disabled =
        false;


    } catch (error) {

      console.error(
        "Miku Stickers error:",
        error
      );


      setStatus(
        error.message ||
        "حدث خطأ أثناء إنشاء الملصقات."
      );


      createButton.disabled =
        false;

    }

  }
);


/* ======================================================
   BLOB → BASE64
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
          typeof result !==
          "string"
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


        resolve(
          comma >= 0
            ? result.substring(
                comma + 1
              )
            : result
        );

      };


      reader.onerror = () => {

        reject(
          new Error(
            "تعذر قراءة الملف."
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
   CREATE COVER
====================================================== */

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
    document.createElement(
      "canvas"
    );


  canvas.width = 96;
  canvas.height = 96;


  const ctx =
    canvas.getContext(
      "2d"
    );


  if (!ctx) {

    return null;

  }


  const scale =
    Math.max(
      96 / image.naturalWidth,
      96 / image.naturalHeight
    );


  const width =
    image.naturalWidth *
    scale;


  const height =
    image.naturalHeight *
    scale;


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


/* ======================================================
   BUILD PACK
====================================================== */

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


  let trayImage =
    null;


  if (cover) {

    trayImage =
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
      trayImage,

    stickers:
      stickers

  };

}


/* ======================================================
   WHATSAPP BRIDGE
====================================================== */

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

        console.error(
          error
        );

      }

    }


    /*
      Browser
    */

    bridgeStatus.textContent =
      "الحزمة جاهزة، لكن الإضافة المباشرة إلى WhatsApp تحتاج Native Bridge.";

    setStatus(
      "تم تجهيز الحزمة بنجاح."
    );

  }
);


/* ======================================================
   INITIAL STATE
====================================================== */

createButton.disabled =
  true;

whatsappButton.disabled =
  true;


setStatus(
  "اختر من 3 إلى 30 صورة."
);
