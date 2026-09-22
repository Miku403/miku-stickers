import {
  blobToBase64
} from "./utils.js";


/*
  تحميل الصورة بطريقة متوافقة
  مع iPhone / Safari / Chrome
*/
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
          new Error("تعذر قراءة إحدى الصور.")
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


/*
  تحويل الصورة إلى Sticker
  الحجم النهائي دائمًا:
  512 × 512
*/
export async function makeSticker(file) {

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
      "المتصفح لا يدعم Canvas."
    );
  }


  /*
    Cover Crop

    الصورة تملأ المربع بالكامل
    بدون فراغات.
  */

  const scale =
    Math.max(
      512 / image.naturalWidth,
      512 / image.naturalHeight
    );


  const width =
    image.naturalWidth * scale;

  const height =
    image.naturalHeight * scale;


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
    تحويل Canvas إلى WebP
  */

  const convert =
    quality => {

      return new Promise(
        resolve => {

          canvas.toBlob(
            blob => {

              resolve(blob);

            },
            "image/webp",
            quality
          );

        }
      );

    };


  const MAX_SIZE =
    100 * 1024;


  /*
    نبدأ بجودة عالية
  */

  let blob =
    await convert(0.92);


  /*
    إذا كان الحجم مناسبًا
  */

  if (
    blob &&
    blob.size <= MAX_SIZE
  ) {

    return blob;

  }


  /*
    Binary Search
    للوصول لأفضل جودة
    تحت 100KB
  */

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
      await convert(
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


  /*
    إذا وجدنا جودة مناسبة
  */

  if (best) {
    return best;
  }


  /*
    محاولة أخيرة
  */

  blob =
    await convert(0.01);


  if (!blob) {

    throw new Error(
      "تعذر تحويل الصورة إلى WebP."
    );

  }


  return blob;
}


/*
  تجهيز Sticker كامل
*/

export async function processSticker(file) {

  const blob =
    await makeSticker(file);


  if (!blob) {

    throw new Error(
      "تعذر إنشاء الملصق."
    );

  }


  const base64 =
    await blobToBase64(blob);


  return {

    blob,

    base64,

    width: 512,

    height: 512,

    size: blob.size

  };
}
