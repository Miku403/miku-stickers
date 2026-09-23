"use strict";

/*
=========================================================
 MIKU STICKERS
 اختيار الصور + GIF معًا
=========================================================
*/

const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const createButton = document.getElementById("createButton");
const whatsappButton = document.getElementById("whatsappButton");
const bridgeStatus = document.getElementById("bridgeStatus");

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;

let selectedFiles = [];


/* ======================================================
   STATUS
====================================================== */

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}


/* ======================================================
   SIZE
====================================================== */

function formatBytes(bytes) {

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}


/* ======================================================
   GIF CHECK
====================================================== */

function isGIF(file) {

  return (
    file.type === "image/gif" ||
    /\.gif$/i.test(file.name)
  );

}


/* ======================================================
   RENDER PREVIEW
====================================================== */

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

    type.textContent =
      isGIF(file)
        ? "GIF متحرك"
        : "صورة";


    const url = URL.createObjectURL(file);

    img.src = url;

    img.onload = () => {
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {

      URL.revokeObjectURL(url);

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


/* ======================================================
   FILE INPUT
====================================================== */

fileInput.addEventListener(
  "change",
  () => {

    console.log(
      "MIKU STICKERS: files selected"
    );


    const files =
      Array.from(
        fileInput.files || []
      );


    console.log(
      "FILES:",
      files
    );


    selectedFiles = [];


    /* --------------------------------------------------
       لا يوجد ملفات
    -------------------------------------------------- */

    if (!files.length) {

      preview.innerHTML = "";

      createButton.disabled = true;

      whatsappButton.disabled = true;

      setStatus(
        "لم يتم اختيار أي ملف."
      );

      return;

    }


    /* --------------------------------------------------
       عدد الملفات
    -------------------------------------------------- */

    if (
      files.length < MIN_STICKERS ||
      files.length > MAX_STICKERS
    ) {

      preview.innerHTML = "";

      createButton.disabled = true;

      whatsappButton.disabled = true;

      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف. تم اختيار ${files.length}.`
      );

      return;

    }


    /* --------------------------------------------------
       السماح بالصور + GIF معًا
    -------------------------------------------------- */

    selectedFiles = files;


    /* --------------------------------------------------
       عرض الملفات
    -------------------------------------------------- */

    renderPreview(
      selectedFiles
    );


    /* --------------------------------------------------
       إحصائيات
    -------------------------------------------------- */

    const gifCount =
      files.filter(
        file => isGIF(file)
      ).length;


    const imageCount =
      files.length -
      gifCount;


    /* --------------------------------------------------
       تفعيل زر الإنشاء
    -------------------------------------------------- */

    createButton.disabled = false;

    whatsappButton.disabled = true;


    /* --------------------------------------------------
       الرسالة
    -------------------------------------------------- */

    if (
      gifCount > 0 &&
      imageCount > 0
    ) {

      setStatus(
        `تم اختيار ${files.length} ملف: ${imageCount} صورة و${gifCount} GIF.`
      );

      if (bridgeStatus) {

        bridgeStatus.textContent =
          "تم تحميل الصور وGIF معًا.";

      }

    } else if (gifCount > 0) {

      setStatus(
        `تم اختيار ${gifCount} GIF بنجاح.`
      );

      if (bridgeStatus) {

        bridgeStatus.textContent =
          "تم تحميل ملفات GIF.";

      }

    } else {

      setStatus(
        `تم اختيار ${imageCount} صورة بنجاح.`
      );

      if (bridgeStatus) {

        bridgeStatus.textContent =
          "تم تحميل الصور.";

      }

    }

  }
);


/* ======================================================
   CREATE BUTTON
====================================================== */

createButton.addEventListener(
  "click",
  () => {

    if (
      selectedFiles.length < MIN_STICKERS
    ) {

      setStatus(
        `اختر ${MIN_STICKERS} ملفات على الأقل.`
      );

      return;

    }


    const gifCount =
      selectedFiles.filter(
        file => isGIF(file)
      ).length;


    const imageCount =
      selectedFiles.length -
      gifCount;


    setStatus(
      `جاهز للتحويل: ${imageCount} صورة + ${gifCount} GIF.`
    );


    if (bridgeStatus) {

      bridgeStatus.textContent =
        "اختيار الملفات ناجح.";

    }

  }
);


/* ======================================================
   SHARE BUTTON
====================================================== */

whatsappButton.addEventListener(
  "click",
  () => {

    setStatus(
      "المشاركة ستُفعّل بعد الانتهاء من نظام التحويل."
    );

  }
);


/* ======================================================
   INITIAL STATE
====================================================== */

createButton.disabled = true;

whatsappButton.disabled = true;


if (bridgeStatus) {

  bridgeStatus.textContent =
    "Miku Stickers جاهز.";

}


setStatus(
  `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف.`
);


console.log(
  "MIKU STICKERS APP LOADED"
);
