const fileInput = document.getElementById("fileInput");
const packName = document.getElementById("packName");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const bridgeStatus = document.getElementById("bridgeStatus");
const createButton = document.getElementById("createButton");
const whatsappButton = document.getElementById("whatsappButton");

let processedStickers = [];
let currentPack = null;


/* =========================
   Status
========================= */

function setStatus(message) {
  status.textContent = message;
}

function setBridgeStatus(message) {
  bridgeStatus.textContent = message;
}


/* =========================
   File Size
========================= */

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
   Read Image
========================= */

function loadImage(file) {
  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => {

      const image = new Image();

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(
          new Error("تعذر قراءة الصورة.")
        );
      };

      image.src = reader.result;
    };

    reader.onerror = () => {
      reject(
        new Error("تعذر قراءة ملف الصورة.")
      );
    };

    reader.readAsDataURL(file);
  });
}


/* =========================
   Canvas → WebP
========================= */

function canvasToWebP(canvas, quality) {
  return new Promise((resolve, reject) => {

    canvas.toBlob(
      blob => {

        if (!blob) {
          reject(
            new Error("تعذر إنشاء WebP.")
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
   Make Sticker
========================= */

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
      "Canvas غير مدعوم."
    );
  }


  const imageWidth =
    image.naturalWidth;

  const imageHeight =
    image.naturalHeight;


  /*
    نحسب Cover Crop
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


  const MAX_SIZE =
    100 * 1024;


  /*
    أول محاولة
  */

  let blob =
    await canvasToWebP(
      canvas,
      0.90
    );


  if (
    blob.size <= MAX_SIZE
  ) {

    return blob;

  }


  /*
    نحاول تقليل الجودة تدريجيًا
  */

  let low = 0.01;
  let high = 0.90;

  let best = null;


  for (
    let i = 0;
    i < 15;
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
    إذا الجودة وحدها ما كفت،
    نقلل التفاصيل قبل الضغط.
  */

  const sizes = [
    448,
    384,
    320,
    256
  ];


  for (
    const workingSize of sizes
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
      (workingSize - smallWidth) / 2;


    const smallY =
      (workingSize - smallHeight) / 2;


    smallCtx.clearRect(
      0,
      0,
      workingSize,
      workingSize
    );


    smallCtx.drawImage(
      image,
      smallX,
      smallY,
      smallWidth,
      smallHeight
    );


    /*
      نرجعها إلى Canvas 512×512
      حتى يبقى الناتج النهائي 512×512.
    */

    ctx.clearRect(
      0,
      0,
      512,
      512
    );


    ctx.drawImage(
      smallCanvas,
      0,
      0,
      512,
      512
    );


    /*
      نبحث عن جودة مناسبة
    */

    low = 0.05;
    high = 0.90;
    best = null;


    for (
      let i = 0;
      i < 15;
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

  }


  /*
    إذا وصلنا هنا،
    الصورة نفسها صعبة جدًا للضغط.
  */

  throw new Error(
    "تعذر ضغط هذه الصورة تحت 100KB."
  );
}

/* =========================
   Preview Card
========================= */

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

  img.src =
    URL.createObjectURL(blob);

  img.alt =
    `Sticker ${index + 1}`;


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
    `512×512 • ${formatBytes(blob.size)}`;


  card.appendChild(img);
  card.appendChild(number);
  card.appendChild(size);


  return card;
}


/* =========================
   Reset
========================= */

function resetProject() {

  processedStickers = [];

  currentPack = null;

  preview.innerHTML = "";

  createButton.disabled = true;

  whatsappButton.disabled = true;

}


/* =========================
   Select Images
========================= */

fileInput.addEventListener(
  "change",
  async () => {

    resetProject();


    const files =
      Array.from(
        fileInput.files || []
      );


    if (
      files.length < 3 ||
      files.length > 30
    ) {

      setStatus(
        `تم اختيار ${files.length} صورة. اختر من 3 إلى 30.`
      );

      return;
    }


    try {

      for (
        let i = 0;
        i < files.length;
        i++
      ) {

        const file =
          files[i];


        /*
          مهم:
          هنا لا نهتم بحجم الصورة الأصلية.
          حتى لو كانت 20MB، نحاول ضغطها.
        */

        setStatus(
          `جاري تحويل الصورة ${i + 1} من ${files.length}...`
        );


        const blob =
          await makeSticker(file);


        const sticker = {
          blob: blob,
          width: 512,
          height: 512,
          size: blob.size
        };


        processedStickers.push(
          sticker
        );


        const card =
          createPreviewCard(
            blob,
            i
          );


        preview.appendChild(
          card
        );
      }


      createButton.disabled =
        false;


      setStatus(
        `تم تجهيز ${files.length} ملصقات ✓`
      );


    } catch (error) {

      console.error(error);


      processedStickers = [];

      createButton.disabled = true;

      whatsappButton.disabled = true;


      setStatus(
        error.message ||
        "حدث خطأ أثناء تجهيز الصور."
      );

    }

  }
);


/* =========================
   Blob → Base64
========================= */

function blobToBase64(blob) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();


      reader.onload = () => {

        const result =
          reader.result;

        resolve(
          result.split(",")[1]
        );
      };


      reader.onerror =
        reject;


      reader.readAsDataURL(blob);
    }
  );
}


/* =========================
   Create Pack
========================= */

createButton.addEventListener(
  "click",
  async () => {

    if (
      processedStickers.length < 3 ||
      processedStickers.length > 30
    ) {

      setStatus(
        "يجب اختيار من 3 إلى 30 ملصقًا."
      );

      return;
    }


    try {

      createButton.disabled = true;


      setStatus(
        "جاري إنشاء الحزمة..."
      );


      const stickerData = [];


      for (
        let i = 0;
        i < processedStickers.length;
        i++
      ) {

        const base64 =
          await blobToBase64(
            processedStickers[i].blob
          );


        stickerData.push({

          image_data:
            base64,

          emojis:
            ["😀"],

          accessibility_text:
            `Miku Sticker ${i + 1}`

        });
      }


      const trayImage =
        await blobToBase64(
          processedStickers[0].blob
        );


      currentPack = {

        ios_app_store_link: "",

        android_play_store_link: "",

        identifier:
          `miku_stickers_${Date.now()}`,

        name:
          packName.value.trim() ||
          "Miku Stickers",

        publisher:
          "Miku Stickers",

        tray_image:
          trayImage,

        stickers:
          stickerData
      };


      whatsappButton.disabled =
        false;


      setStatus(
        "تم إنشاء حزمة الملصقات ✓"
      );


      setBridgeStatus(
        "الحزمة جاهزة لـ Native Bridge."
      );


      console.log(
        "Miku Pack:",
        currentPack
      );


    } catch (error) {

      console.error(error);


      setStatus(
        error.message ||
        "تعذر إنشاء الحزمة."
      );

    } finally {

      createButton.disabled =
        false;
    }

  }
);


/* =========================
   WhatsApp
========================= */

whatsappButton.addEventListener(
  "click",
  () => {

    if (!currentPack) {

      setStatus(
        "أنشئ الحزمة أولًا."
      );

      return;
    }


    setStatus(
      "الحزمة جاهزة لـ WhatsApp ✓"
    );


    setBridgeStatus(
      "Native Bridge غير مثبت حاليًا."
    );


    console.log(
      "Ready for WhatsApp:",
      currentPack
    );

  }
);


/* =========================
   Initial
========================= */

setStatus(
  "اختر من 3 إلى 30 صورة."
);

setBridgeStatus(
  "Miku Stickers جاهز."
);
