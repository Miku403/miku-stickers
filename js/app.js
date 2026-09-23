"use strict";

/*
=========================================================
 MIKU STICKERS
 TEST VERSION
 اختيار الصور + عرضها فقط
=========================================================
*/

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


/* ======================================================
   SETTINGS
====================================================== */

const MIN_STICKERS = 3;
const MAX_STICKERS = 30;


/* ======================================================
   STATE
====================================================== */

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
   FILE SIZE
====================================================== */

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
        ? "GIF متحرك"
        : "صورة";


    const url =
      URL.createObjectURL(file);


    img.src = url;


    img.onload = () => {

      URL.revokeObjectURL(url);

    };


    img.onerror = () => {

      URL.revokeObjectURL(url);

      console.error(
        "تعذر عرض الصورة:",
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
      "MIKU STICKERS: change event"
    );


    const files =
      Array.from(
        fileInput.files || []
      );


    console.log(
      "Selected files:",
      files
    );


    selectedFiles =
      [];


    /*
    ------------------------------------------------------
    لا يوجد اختيار
    ------------------------------------------------------
    */

    if (!files.length) {

      preview.innerHTML = "";

      createButton.disabled = true;

      whatsappButton.disabled = true;

      setStatus(
        "لم يتم اختيار أي ملف."
      );

      return;

    }


    /*
    ------------------------------------------------------
    عدد الملفات
    ------------------------------------------------------
    */

    if (
      files.length <
        MIN_STICKERS ||
      files.length >
        MAX_STICKERS
    ) {

      preview.innerHTML = "";

      createButton.disabled = true;

      whatsappButton.disabled = true;

      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف. تم اختيار ${files.length}.`
      );

      return;

    }


    /*
    ------------------------------------------------------
    التحقق من GIF + الصور
    ------------------------------------------------------
    */

    const hasGIF =
      files.some(
        file => isGIF(file)
      );


    const hasStatic =
      files.some(
        file => !isGIF(file)
      );


    if (
      hasGIF &&
      hasStatic
    ) {

      preview.innerHTML = "";

      createButton.disabled = true;

      whatsappButton.disabled = true;

      setStatus(
        "لا يمكن خلط GIF مع الصور الثابتة."
      );

      if (bridgeStatus) {

        bridgeStatus.textContent =
          "اختر GIF فقط أو صور ثابتة فقط.";

      }

      return;

    }


    /*
    ------------------------------------------------------
    حفظ الملفات
    ------------------------------------------------------
    */

    selectedFiles =
      files;


    /*
    ------------------------------------------------------
    عرض الصور
    ------------------------------------------------------
    */

    renderPreview(
      selectedFiles
    );


    /*
    ------------------------------------------------------
    تفعيل زر الإنشاء
    ------------------------------------------------------
    */

    createButton.disabled =
      false;


    whatsappButton.disabled =
      true;


    /*
    ------------------------------------------------------
    الحالة
    ------------------------------------------------------
    */

    if (hasGIF) {

      setStatus(
        `تم اختيار ${files.length} GIF بنجاح.`
      );


      if (bridgeStatus) {

        bridgeStatus.textContent =
          "تم تحميل ملفات GIF.";

      }

    } else {

      setStatus(
        `تم اختيار ${files.length} صورة بنجاح.`
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
      selectedFiles.length <
        MIN_STICKERS
    ) {

      setStatus(
        "اختر 3 ملفات على الأقل."
      );

      return;

    }


    setStatus(
      `تم اختيار ${selectedFiles.length} ملف. نظام التحويل لم يُفعّل بعد.`
    );


    if (bridgeStatus) {

      bridgeStatus.textContent =
        "اختبار اختيار الملفات ناجح.";

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
      "المشاركة لم تُفعّل في نسخة الاختبار."
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


if (bridgeStatus) {

  bridgeStatus.textContent =
    "Miku Stickers جاهز.";

}


setStatus(
  `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف.`
);


console.log(
  "MIKU STICKERS APP LOADED SUCCESSFULLY"
);
