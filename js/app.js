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


/* =========================================================
   SETTINGS
========================================================= */

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;

const STICKER_SIZE = 512;
const MAX_SIZE = 100 * 1024;


/* =========================================================
   DATA
========================================================= */

let selectedFiles = [];
let generatedStickers = [];
let generatedPack = null;


/* =========================================================
   LOAD IMAGE
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
   CANVAS → WEBP
========================================================= */

function canvasToWebP(canvas, quality) {

  return new Promise((resolve, reject) => {

    canvas.toBlob(
      (blob) => {

        if (!blob) {

          reject(
            new Error(
              "المتصفح لم يُرجع ملفًا."
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
   FORMAT SIZE
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
   STATUS
========================================================= */

function setStatus(message) {

  if (status) {
    status.textContent = message;
  }

}


/* =========================================================
   CREATE STICKER
========================================================= */

async function makeSticker(file) {

  const image =
    await loadImage(file);


  /*
    Final canvas:
    always 512×512
  */

  const canvas =
    document.createElement("canvas");

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


  const imageWidth =
    image.naturalWidth;

  const imageHeight =
    image.naturalHeight;


  /*
    Cover crop
  */

  const scale =
    Math.max(
      STICKER_SIZE / imageWidth,
      STICKER_SIZE / imageHeight
    );


  const width =
    imageWidth * scale;

  const height =
    imageHeight * scale;


  const x =
    (STICKER_SIZE - width) / 2;

  const y =
    (STICKER_SIZE - height) / 2;


  ctx.clearRect(
    0,
    0,
    STICKER_SIZE,
    STICKER_SIZE
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


  /*
    أول اختبار WebP
  */

  const firstBlob =
    await canvasToWebP(
      canvas,
      0.01
    );


  if (!firstBlob) {

    throw new Error(
      "المتصفح لم يتمكن من إنشاء الملف."
    );

  }


  console.log(
    "WebP test type:",
    firstBlob.type
  );

  console.log(
    "WebP test size:",
    firstBlob.size
  );


  /*
    إذا دخل تحت 100KB
  */

  if (
    firstBlob.size <=
    MAX_SIZE
  ) {

    return firstBlob;

  }


  /*
    إذا المتصفح لم ينشئ WebP
  */

  if (
    firstBlob.type !==
    "image/webp"
  ) {

    throw new Error(
      "المتصفح لم ينشئ WebP. " +
      "الصيغة الناتجة: " +
      (
        firstBlob.type ||
        "غير معروفة"
      ) +
      " — الحجم: " +
      formatSize(
        firstBlob.size
      )
    );

  }


  /*
    البحث عن جودة أقل من 100KB
  */

  let best = null;


  for (
    let quality = 0.90;
    quality >= 0.001;
    quality -= 0.02
  ) {

    const blob =
      await canvasToWebP(
        canvas,
        quality
      );


    console.log(
      "quality:",
      quality.toFixed(3),
      "size:",
      formatSize(
        blob.size
      )
    );


    if (
      blob.size <=
      MAX_SIZE
    ) {

      best = blob;

      break;

    }

  }


  if (best) {

    return best;

  }


  /*
    إذا الجودة وحدها لم تكف،
    نقلل التفاصيل داخليًا.
  */

  const workingSizes = [
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

    const smallCanvas =
      document.createElement(
        "canvas"
      );


    smallCanvas.width =
      workingSize;

    smallCanvas.height =
      workingSize;


    const smallCtx =
      smallCanvas.getContext(
        "2d"
      );


    if (!smallCtx) {
      continue;
    }


    const smallScale =
      Math.max(
        workingSize / imageWidth,
        workingSize / imageHeight
      );


    const smallWidth =
      imageWidth * smallScale;

    const smallHeight =
      imageHeight * smallScale;


    const smallX =
      (
        workingSize -
        smallWidth
      ) / 2;


    const smallY =
      (
        workingSize -
        smallHeight
      ) / 2;


    smallCtx.clearRect(
      0,
      0,
      workingSize,
      workingSize
    );


    smallCtx.imageSmoothingEnabled =
      true;

    smallCtx.imageSmoothingQuality =
      "medium";


    smallCtx.drawImage(
      image,
      smallX,
      smallY,
      smallWidth,
      smallHeight
    );


    /*
      Upscale back to 512×512
    */

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
      smallCanvas,
      0,
      0,
      STICKER_SIZE,
      STICKER_SIZE
    );


    /*
      Try very low quality first
    */

    let smallest =
      await canvasToWebP(
        canvas,
        0.001
      );


    if (
      smallest.size <=
      MAX_SIZE
    ) {

      return smallest;

    }


    /*
      Search quality
    */

    best = null;


    for (
      let quality = 0.80;
      quality >= 0.001;
      quality -= 0.02
    ) {

      const blob =
        await canvasToWebP(
          canvas,
          quality
        );


      if (
        blob.size <=
        MAX_SIZE
      ) {

        best = blob;

        break;

      }

    }


    if (best) {

      return best;

    }

  }


  /*
    Nothing worked
  */

  throw new Error(
    "تعذر ضغط هذه الصورة تحت 100KB."
  );

}


/* =========================================================
   PREVIEW
========================================================= */

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
        "ملصق " +
        (index + 1);


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


/* =========================================================
   FILE INPUT
========================================================= */

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

    whatsappButton.disabled =
      true;

    createButton.disabled =
      false;

    renderPreview();

  }
);


/* =========================================================
   CREATE BUTTON
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


    createButton.disabled =
      true;

    whatsappButton.disabled =
      true;

    generatedStickers = [];
    generatedPack = null;


    try {

      /*
        Process every image
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
          "تم تجهيز الملصق " +
          (i + 1) +
          " — " +
          formatSize(
            blob.size
          )
        );

      }


      /*
        Build pack
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


/* =========================================================
   BLOB → BASE64
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


      reader.readAsDataURL(
        blob
      );

    }
  );

}


/* =========================================================
   CREATE COVER
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
   BUILD PACK
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

    const data =
      await blobToBase64(
        sticker.blob
      );


    stickers.push({

      file:
        sticker.index +
        ".webp",

      data:
        data

    });

  }


  const cover =
    await createCover();


  let trayImage = null;


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


/* =========================================================
   WHATSAPP
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


/* =========================================================
   INITIAL STATE
========================================================= */

createButton.disabled =
  true;

whatsappButton.disabled =
  true;

setStatus(
  "اختر من 3 إلى 30 صورة."
);
