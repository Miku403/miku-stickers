/* =========================================
   MIKU STICKERS
   Main App
========================================= */


/* =========================================
   Elements
========================================= */

const fileInput =
  document.getElementById("fileInput");

const packName =
  document.getElementById("packName");

const preview =
  document.getElementById("preview");

const status =
  document.getElementById("status");

const bridgeStatus =
  document.getElementById("bridgeStatus");

const createButton =
  document.getElementById("createButton");

const whatsappButton =
  document.getElementById("whatsappButton");


/* =========================================
   Data
========================================= */

let selectedFiles = [];

let processedStickers = [];

let currentPack = null;


/* =========================================
   Status
========================================= */

function setStatus(message) {

  status.textContent =
    message;

}


function setBridgeStatus(message) {

  bridgeStatus.textContent =
    message;

}


/* =========================================
   Format File Size
========================================= */

function formatBytes(bytes) {

  if (bytes < 1024) {

    return `${bytes} B`;

  }


  if (bytes < 1024 * 1024) {

    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;

  }


  return `${(
    bytes / 1024 / 1024
  ).toFixed(2)} MB`;

}


/* =========================================
   Load Image
========================================= */

function loadImage(file) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();


      reader.onload =
        function () {

          const image =
            new Image();


          image.onload =
            function () {

              resolve(image);

            };


          image.onerror =
            function () {

              reject(
                new Error(
                  "تعذر قراءة إحدى الصور."
                )
              );

            };


          image.src =
            reader.result;

        };


      reader.onerror =
        function () {

          reject(
            new Error(
              "تعذر قراءة ملف الصورة."
            )
          );

        };


      reader.readAsDataURL(file);

    }
  );

}


/* =========================================
   Convert Canvas To WebP
========================================= */

function canvasToWebP(
  canvas,
  quality
) {

  return new Promise(
    (resolve, reject) => {

      canvas.toBlob(
        function (blob) {

          if (!blob) {

            reject(
              new Error(
                "تعذر تحويل الصورة إلى WebP."
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


/* =========================================
   Create Sticker
   512 × 512
   Cover Crop
========================================= */

async function makeSticker(file) {

  const image =
    await loadImage(file);


  const canvas =
    document.createElement("canvas");


  canvas.width = 512;
  canvas.height = 512;


  const ctx =
    canvas.getContext("2d");


  if (!ctx) {

    throw new Error(
      "Canvas غير مدعوم في هذا المتصفح."
    );

  }


  const imageWidth =
    image.naturalWidth ||
    image.width;


  const imageHeight =
    image.naturalHeight ||
    image.height;


  if (
    !imageWidth ||
    !imageHeight
  ) {

    throw new Error(
      "أبعاد الصورة غير صالحة."
    );

  }


  /*
    Cover Crop

    الصورة تملأ 512×512
    بالكامل بدون فراغات.
  */

  const scale =
    Math.max(
      512 / imageWidth,
      512 / imageHeight
    );


  const width =
    imageWidth * scale;


  const height =
    imageHeight * scale;


  const x =
    (512 - width) / 2;


  const y =
    (512 - height) / 2;


  ctx.clearRect(
    0,
    0,
    512,
    512
  );


  ctx.drawImage(
    image,
    x,
    y,
    width,
    height
  );


  /*
    لا نحتاج الصورة الأصلية
    بعد الرسم.
  */

  image.src = "";


  /* =====================================
     محاولة بجودة عالية
  ===================================== */

  let blob =
    await canvasToWebP(
      canvas,
      0.92
    );


  const MAX_SIZE =
    100 * 1024;


  if (
    blob.size <= MAX_SIZE
  ) {

    return blob;

  }


  /* =====================================
     البحث عن أفضل جودة تحت 100KB
  ===================================== */

  let low = 0.05;

  let high = 0.90;

  let best = null;


  for (
    let i = 0;
    i < 14;
    i++
  ) {

    const quality =
      (low + high) / 2;


    blob =
      await canvasToWebP(
        canvas,
        quality
      );


    if (
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


  /*
    محاولة أخيرة
  */

  return await canvasToWebP(
    canvas,
    0.01
  );

}


/* =========================================
   Create Preview Card
========================================= */

function createPreviewCard(
  blob,
  index
) {

  const card =
    document.createElement("div");


  card.className =
    "sticker-card";


  const img =
    document.createElement("img");


  const url =
    URL.createObjectURL(blob);


  img.src =
    url;


  img.alt =
    `Sticker ${index + 1}`;


  img.onload =
    function () {

      /*
        نخلي الـ URL موجود
        لأن الصورة تستخدمه.
      */

    };


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
    `512×512 • ${formatBytes(
      blob.size
    )}`;


  card.appendChild(img);

  card.appendChild(number);

  card.appendChild(size);


  return card;

}


/* =========================================
   Reset
========================================= */

function resetProject() {

  selectedFiles = [];

  processedStickers = [];

  currentPack = null;


  preview.innerHTML =
    "";


  createButton.disabled =
    true;


  whatsappButton.disabled =
    true;


  setBridgeStatus(
    "Miku Stickers جاهز."
  );

}


/* =========================================
   FILE INPUT
========================================= */

fileInput.addEventListener(
  "change",
  async function () {

    resetProject();


    /*
      الحصول على الصور
    */

    selectedFiles =
      Array.from(
        fileInput.files || []
      );


    console.log(
      "Selected files:",
      selectedFiles
    );


    /* =====================================
       التحقق من العدد
    ===================================== */

    if (
      selectedFiles.length < 3 ||
      selectedFiles.length > 30
    ) {

      setStatus(
        `تم اختيار ${
          selectedFiles.length
        } صورة. اختر من 3 إلى 30 صورة.`
      );

      return;

    }


    try {

      setStatus(
        `تم اختيار ${
          selectedFiles.length
        } صورة. جاري تجهيزها...`
      );


      /* ===================================
         معالجة الصور واحدة واحدة
      =================================== */

      for (
        let i = 0;
        i < selectedFiles.length;
        i++
      ) {

        const file =
          selectedFiles[i];


        setStatus(
          `جاري تجهيز الملصق ${
            i + 1
          } من ${
            selectedFiles.length
          }...`
        );


        console.log(
          "Processing:",
          file.name
        );


        const blob =
          await makeSticker(
            file
          );


        /* ================================
           التحقق من الحجم
        ================================= */

        if (
          blob.size >
          100 * 1024
        ) {

          throw new Error(
            `الملصق ${
              i + 1
            } أكبر من 100KB.`
          );

        }


        /*
          تخزين الملصق
        */

        const sticker = {

          blob: blob,

          width: 512,

          height: 512,

          size: blob.size

        };


        processedStickers.push(
          sticker
        );


        /*
          عرض المعاينة فورًا
        */

        const card =
          createPreviewCard(
            blob,
            i
          );


        preview.appendChild(
          card
        );


        console.log(
          `Sticker ${
            i + 1
          } ready`
        );

      }


      /* ===================================
         اكتملت المعالجة
      ================================= */

      createButton.disabled =
        false;


      setStatus(
        `تم تجهيز ${
          processedStickers.length
        } ملصقات ✓`
      );


      console.log(
        "Processed stickers:",
        processedStickers
      );


    } catch (error) {

      console.error(
        "Sticker error:",
        error
      );


      processedStickers = [];

      currentPack = null;


      createButton.disabled =
        true;


      whatsappButton.disabled =
        true;


      setStatus(
        error.message ||
        "حدث خطأ أثناء تجهيز الصور."
      );

    }

  }
);


/* =========================================
   CREATE PACK
========================================= */

createButton.addEventListener(
  "click",
  async function () {

    if (
      processedStickers.length < 3 ||
      processedStickers.length > 30
    ) {

      setStatus(
        "يجب اختيار من 3 إلى 30 صورة."
      );

      return;

    }


    try {

      createButton.disabled =
        true;


      whatsappButton.disabled =
        true;


      setStatus(
        "جاري إنشاء حزمة الملصقات..."
      );


      /*
        تحويل الصور إلى Base64
      */

      const stickers = [];


      for (
        let i = 0;
        i < processedStickers.length;
        i++
      ) {

        const sticker =
          processedStickers[i];


        const base64 =
          await blobToBase64(
            sticker.blob
          );


        stickers.push({

          image_data:
            base64,

          emojis:
            ["😀"],

          accessibility_text:
            `Miku Sticker ${
              i + 1
            }`

        });

      }


      /*
        الغلاف = أول ملصق
      */

      const trayImage =
        await blobToBase64(
          processedStickers[0].blob
        );


      currentPack = {

        ios_app_store_link:
          "",

        android_play_store_link:
          "",

        identifier:
          "miku_stickers_" +
          Date.now(),

        name:
          packName.value.trim() ||
          "Miku Stickers",

        publisher:
          "Miku Stickers",

        tray_image:
          trayImage,

        stickers:
          stickers

      };


      /*
        تأكيد الحزمة
      */

      if (
        currentPack.stickers.length < 3 ||
        currentPack.stickers.length > 30
      ) {

        throw new Error(
          "عدد الملصقات غير صحيح."
        );

      }


      whatsappButton.disabled =
        false;


      setStatus(
        "تم إنشاء الحزمة بنجاح ✓"
      );


      setBridgeStatus(
        "الحزمة جاهزة للإرسال إلى Native Bridge."
      );


      console.log(
        "PACK:",
        currentPack
      );


    } catch (error) {

      console.error(
        "Pack error:",
        error
      );


      currentPack = null;


      whatsappButton.disabled =
        true;


      setStatus(
        error.message ||
        "تعذر إنشاء الحزمة."
      );


      setBridgeStatus("");

    } finally {

      createButton.disabled =
        false;

    }

  }
);


/* =========================================
   Blob → Base64
========================================= */

function blobToBase64(blob) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();


      reader.onload =
        function () {

          const result =
            reader.result;


          const base64 =
            result.split(",")[1];


          resolve(
            base64
          );

        };


      reader.onerror =
        reject;


      reader.readAsDataURL(
        blob
      );

    }
  );

}


/* =========================================
   WhatsApp Button
========================================= */

whatsappButton.addEventListener(
  "click",
  async function () {

    if (!currentPack) {

      setStatus(
        "أنشئ الحزمة أولًا."
      );

      return;

    }


    /*
      حاليًا Native Bridge
      غير موجود داخل الموقع العادي.

      لذلك نعرض حالة واضحة
      بدل إعطاء المستخدم إحساس
      أن WhatsApp استلم الحزمة.
    */

    setStatus(
      "الحزمة جاهزة لـ WhatsApp ✓"
    );


    setBridgeStatus(
      "Native Bridge غير مثبت حاليًا."
    );


    console.log(
      "Pack ready for native bridge:",
      currentPack
    );

  }
);


/* =========================================
   Initial State
========================================= */

setStatus(
  "اختر من 3 إلى 30 صورة."
);


setBridgeStatus(
  "Miku Stickers جاهز."
);
