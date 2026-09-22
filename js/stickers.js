import {
  blobToBase64
} from "./utils.js";


export async function makeSticker(file) {

  const image =
    await createImageBitmap(file);

  const canvas =
    document.createElement("canvas");

  canvas.width = 512;
  canvas.height = 512;

  const ctx =
    canvas.getContext("2d");

  /*
    COVER

    نكبر الصورة حتى تغطي
    المربع بالكامل.
  */

  const scale =
    Math.max(
      512 / image.width,
      512 / image.height
    );

  const width =
    image.width * scale;

  const height =
    image.height * scale;

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

  image.close();


  const convert = quality => {

    return new Promise(resolve => {

      canvas.toBlob(
        blob => resolve(blob),
        "image/webp",
        quality
      );

    });

  };


  const MAX_SIZE =
    100 * 1024;


  let blob =
    await convert(.92);


  if (blob.size <= MAX_SIZE) {
    return blob;
  }


  let low = .05;
  let high = .90;

  let best = null;


  for (
    let i = 0;
    i < 14;
    i++
  ) {

    const quality =
      (low + high) / 2;

    blob =
      await convert(quality);


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


  return await convert(.01);
}


export async function processSticker(file) {

  const blob =
    await makeSticker(file);

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
