"use strict";

/* =========================================================
   MIKU STICKERS
   تحويل الصور إلى ملصقات WhatsApp
   ========================================================= */


/* =========================
   العناصر
========================= */

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


/* =========================
   الإعدادات
========================= */

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;

const STICKER_SIZE = 512;

const MAX_FILE_SIZE =
  100 * 1024;


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
          "تعذر قراءة إحدى الصور."
        )
      );

    };

    image.src = url;

  });

}


/* =========================================================
   تحويل Canvas إلى WebP
========================================================= */

function canvasToWebP(
  canvas,
  quality
) {

  return new Promise((resolve, reject) => {

    canvas.toBlob(
      (blob) => {

        if (!blob) {

          reject(
            new Error(
              "تعذر إنشاء ملف WebP."
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
   إنشاء ملصق 512×512 وتحت 100KB
========================================================= */

async function makeSticker(file) {

  const image =
    await loadImage(file);


  /*
    Canvas النهائي دائمًا 512×512
  */

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


  /*
    نتأكد أن WebP مدعوم
  */

  const testBlob =
    await canvasToWebP(
      finalCanvas,
      0.1
    );


  if (
    !testBlob ||
    testBlob.type !== "image/webp"
  ) {

    throw new Error(
      "المتصفح لم يتمكن من إنشاء WebP."
    );

  }


  /*
    أحجام العمل.
    
    حتى لو استخدمنا 32×32 داخليًا،
    الناتج النهائي يبقى 512×512.
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


  const imageWidth =
    image.naturalWidth;

  const imageHeight =
    image.naturalHeight;


  /*
    نجرب الأحجام بالتدريج
  */

  for (
    const workingSize of workingSizes
  ) {


    /*
      Canvas صغير للعمل
    */

    const workCanvas =
      document.createElement(
        "canvas"
      );

    workCanvas.width =
      workingSize;

    workCanvas.height =
      workingSize;


    const workCtx =
      workCanvas.getContext(
        "2d"
      );


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


    const drawWidth =
      imageWidth * scale;

    const drawHeight =
      imageHeight * scale;


    const drawX =
      (
        workingSize -
        drawWidth
      ) / 2;


    const drawY =
      (
        workingSize -
        drawHeight
      ) / 2;


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
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );


    /*
      نرجع الصورة إلى 512×512
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
      نجرب أقل جودة أولًا
    */

    let blob =
      await canvasToWebP(
        finalCanvas,
        0.001
      );


    /*
      إذا دخل تحت 100KB
    */

    if (
      blob &&
      blob.type === "image/webp" &&
      blob.size <= MAX_FILE_SIZE
    ) {

      return blob;

    }


    /*
      Binary Search
      نبحث عن أعلى جودة ممكنة
      بدون تجاوز 100KB
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
        (
          low +
          high
        ) / 2;


      blob =
        await canvasToWebP(
          finalCanvas,
          quality
        );


      if (
        blob &&
        blob.type === "image/webp" &&
        blob.size <= MAX_FILE_SIZE
      ) {

        best = blob;

        low = quality;

      } else {

        high = quality;

      }

    }


    /*
      وجدنا ملفًا مناسبًا
    */

    if (best) {

      return best;

    }

  }


  /*
    محاولة طوارئ شديدة
  */

  const emergencyCanvas =
    document.createElement(
      "canvas"
    );


  emergencyCanvas.width = 16;
  emergencyCanvas.height = 16;


  const emergencyCtx =
    emergencyCanvas.getContext(
      "2d"
    );


  if (!emergencyCtx) {

    throw new Error(
      "Canvas غير مدعوم."
    );

  }


  const emergencyScale =
    Math.max(
      16 / imageWidth,
      16 / imageHeight
    );


  const emergencyWidth =
    imageWidth *
    emergencyScale;


  const emergencyHeight =
    imageHeight *
    emergencyScale;


  emergencyCtx.clearRect(
    0,
    0,
    16,
    16
  );


  emergencyCtx.drawImage(
    image,
    (16 - emergencyWidth) / 2,
    (16 - emergencyHeight) / 2,
    emergencyWidth,
    emergencyHeight
  );


  finalCtx.clearRect(
    0,
    0,
    STICKER_SIZE,
    STICKER_SIZE
  );


  finalCtx.drawImage(
    emergencyCanvas,
    0,
    0,
    STICKER_SIZE,
    STICKER_SIZE
  );


  const emergencyBlob =
    await canvasToWebP(
      finalCanvas,
      0.001
    );


  if (
    emergencyBlob &&
    emergencyBlob.type === "image/webp" &&
    emergencyBlob.size <= MAX_FILE_SIZE
  ) {

    return emergencyBlob;

  }


  const finalSize =
    emergencyBlob
      ? (
          emergencyBlob.size /
          1024
        ).toFixed(1)
      : "غير معروف";


  throw new Error(
    "تعذر ضغط الملصق تحت 100KB. " +
    "الحجم النهائي: " +
    finalSize +
    " KB"
  );

}


/* =========================================================
   حجم الملف
========================================================= */

function formatSize(bytes) {

  if (bytes < 1024) {

    return (
      bytes +
      " B"
    );

  }


  return (
    bytes / 1024
  ).toFixed(1) +
  " KB";

}


/* =========================================================
   تحديث الحالة
========================================================= */

function setStatus(message) {

  if (status) {

    status.textContent =
      message;

  }

}


/* =========================================================
   عرض المعاينة
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


      const image =
        document.createElement(
          "img"
        );


      const url =
        URL.createObjectURL(
          file
        );


      image.src = url;

      image.onload = () => {

        URL.revokeObjectURL(
          url
        );

      };


      image.alt =
        "ملصق " +
        (index + 1);


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


      card.appendChild(
        image
      );

      card.appendChild(
        number
      );

      card.appendChild(
        size
      );


      preview.appendChild(
        card
      );

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
      files.length <
      MIN_STICKERS
    ) {

      selectedFiles = [];

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
   إنشاء الحزمة
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


        /*
          تحقق نهائي
        */

        if (
          blob.type !==
          "image/webp"
        ) {

          throw new Error(
            "الناتج ليس WebP."
          );

        }


        if (
          blob.size >
          MAX_FILE_SIZE
        ) {

          throw new Error(
            "الملصق " +
            (i + 1) +
            " تجاوز 100KB."
          );

        }


        generatedStickers.push(
          {
            index: i + 1,
            blob: blob
          }
        );


        setStatus(
          "تم تجهيز الملصق " +
          (i + 1) +
          " — " +
          formatSize(
            blob.size
          )
        );

      }


      setStatus(
        "تم تجهيز جميع الملصقات بنجاح."
      );


      createButton.disabled =
        false;


      whatsappButton.disabled =
        false;


      /*
        ننشئ بيانات الحزمة
      */

      generatedPack =
        await buildPack();


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
   تحويل Blob إلى Base64
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
   إنشاء صورة الغلاف
========================================================= */

async function createCover() {

  if (
    generatedStickers.length === 0
  ) {

    return null;

  }


  const first =
    generatedStickers[0].blob;


  const image =
    await loadImage(
      new File(
        [first],
        "sticker.webp",
        {
          type: "image/webp"
        }
      )
    );


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

    throw new Error(
      "تعذر إنشاء الغلاف."
    );

  }


  ctx.clearRect(
    0,
    0,
    96,
    96
  );


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


  ctx.drawImage(
    image,
    (96 - width) / 2,
    (96 - height) / 2,
    width,
    height
  );


  return new Promise(
    (resolve, reject) => {

      canvas.toBlob(
        (blob) => {

          if (!blob) {

            reject(
              new Error(
                "تعذر إنشاء صورة الغلاف."
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


/* =========================================================
   إنشاء بيانات الحزمة
========================================================= */

async function buildPack() {

  const name =
    (
      packNameInput.value ||
      "Miku Stickers"
    ).trim();


  const publisher =
    "Miku Stickers";


  const identifier =
    "com.miku.stickers." +
    Date.now();


  const stickers = [];


  for (
    const sticker of generatedStickers
  ) {

    const base64 =
      await blobToBase64(
        sticker.blob
      );


    stickers.push(
      {
        file:
          sticker.index +
          ".webp",

        data:
          base64
      }
    );

  }


  const cover =
    await createCover();


  const coverBase64 =
    cover
      ? await blobToBase64(
          cover
        )
      : null;


  return {

    identifier:
      identifier,

    name:
      name,

    publisher:
      publisher,

    tray_image:
      coverBase64,

    stickers:
      stickers

  };

}


/* =========================================================
   زر WhatsApp
========================================================= */

whatsappButton.addEventListener(
  "click",
  async () => {

    if (!generatedPack) {

      setStatus(
        "أنشئ الحزمة أولًا."
      );

      return;

    }


    /*
      إذا كان الموقع داخل تطبيق Native
      يحتوي على Bridge لـ iOS
    */

    if (
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.mikuStickers
    ) {

      try {

        window.webkit.messageHandlers.mikuStickers.postMessage(
          {
            action:
              "importPack",

            pack:
              generatedPack
          }
        );


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
      الموقع يعمل حاليًا داخل المتصفح.
    */

    bridgeStatus.textContent =
      "الحزمة جاهزة، لكن إضافة الملصقات مباشرة إلى WhatsApp تحتاج تطبيق Native Bridge.";

    setStatus(
      "تم تجهيز الحزمة بنجاح."
    );

  }
);


/* =========================================================
   حالة أولية
========================================================= */

if (createButton) {

  createButton.disabled =
    true;

}


if (whatsappButton) {

  whatsappButton.disabled =
    true;

}


setStatus(
  "اختر من 3 إلى 30 صورة."
);
