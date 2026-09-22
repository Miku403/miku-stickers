import {
  processSticker
} from "./stickers.js";

import {
  createPack
} from "./pack.js";

import {
  sendToWhatsApp
} from "./whatsapp.js";

import {
  formatBytes
} from "./utils.js";


const fileInput =
  document.getElementById(
    "fileInput"
  );

const packName =
  document.getElementById(
    "packName"
  );

const preview =
  document.getElementById(
    "preview"
  );

const status =
  document.getElementById(
    "status"
  );

const createButton =
  document.getElementById(
    "createButton"
  );

const whatsappButton =
  document.getElementById(
    "whatsappButton"
  );


let processedStickers = [];
let currentPack = null;


function setStatus(text) {
  status.textContent = text;
}


fileInput.addEventListener(
  "change",
  async () => {

    processedStickers = [];
    currentPack = null;

    preview.innerHTML = "";

    whatsappButton.disabled = true;
    createButton.disabled = true;


    const files =
      Array.from(
        fileInput.files
      );


    if (
      files.length < 3 ||
      files.length > 30
    ) {

      setStatus(
        "اختر من 3 إلى 30 صورة"
      );

      return;
    }


    try {

      setStatus(
        "جاري تجهيز الملصقات..."
      );


      for (
        let i = 0;
        i < files.length;
        i++
      ) {

        const sticker =
          await processSticker(
            files[i]
          );

        processedStickers.push(
          sticker
        );


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

        img.src =
          URL.createObjectURL(
            sticker.blob
          );


        const number =
          document.createElement(
            "div"
          );

        number.className =
          "sticker-number";

        number.textContent =
          `#${i + 1}`;


        const size =
          document.createElement(
            "div"
          );

        size.className =
          "sticker-size";

        size.textContent =
          formatBytes(
            sticker.size
          );


        card.appendChild(img);
        card.appendChild(number);
        card.appendChild(size);

        preview.appendChild(card);
      }


      createButton.disabled =
        false;

      setStatus(
        `${files.length} ملصقات جاهزة`
      );


    } catch (error) {

      console.error(error);

      setStatus(
        "حدث خطأ أثناء معالجة الصور"
      );

    }

  }
);


createButton.addEventListener(
  "click",
  async () => {

    try {

      setStatus(
        "جاري إنشاء الحزمة..."
      );


      currentPack =
        await createPack(
          packName.value,
          processedStickers
        );


      whatsappButton.disabled =
        false;


      setStatus(
        "تم إنشاء الحزمة بنجاح ✓"
      );


      /*
        للتجربة فقط:
        عرض JSON في Console
      */

      console.log(
        "WhatsApp Pack:",
        currentPack
      );


    } catch (error) {

      console.error(error);

      setStatus(
        error.message ||
        "تعذر إنشاء الحزمة"
      );

    }

  }
);


whatsappButton.addEventListener(
  "click",
  async () => {

    if (!currentPack) {
      return;
    }

    await sendToWhatsApp(
      currentPack
    );

  }
);
