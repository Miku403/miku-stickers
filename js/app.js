"use strict";

/*
=========================================================
 MIKU STICKERS
 PNG / JPG / WEBP / GIF / VIDEO
        ↓
     512×512
        ↓
 WebP / Animated WebP
        ↓
    Compression
        ↓
    .wastickers
=========================================================
*/

import {
  encodeRGBA,
  encodeAnimation
} from "https://esm.sh/wasm-webp@0.1.0";

import {
  parseGIF,
  decompressFrames
} from "https://esm.sh/gifuct-js@2.1.2";


/* ======================================================
   DOM
====================================================== */

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

const SIZE = 512;

const COVER_SIZE = 96;

const STATIC_MAX =
  100 * 1024;

const ANIMATED_MAX =
  500 * 1024;

const MAX_ANIMATION_MS =
  10 * 1000;

const MIN_FRAME_MS =
  40;

const MAX_FRAMES =
  60;


/*
 * Video frame sampling.
 *
 * 15 FPS keeps mobile processing reasonable.
 */
const VIDEO_FPS = 15;


/* ======================================================
   STATE
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
   FORMAT BYTES
====================================================== */

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
    bytes /
    1024 /
    1024
  ).toFixed(2)} MB`;

}


/* ======================================================
   FILE TYPE
====================================================== */

function isGIF(file) {

  return (
    file.type === "image/gif" ||
    /\.gif$/i.test(file.name)
  );

}


function isVideo(file) {

  return (
    file.type.startsWith("video/") ||
    /\.(mp4|mov|m4v|webm|ogv|avi)$/i.test(
      file.name
    )
  );

}


function isImage(file) {

  return (
    file.type.startsWith("image/") &&
    !isGIF(file)
  );

}


/* ======================================================
   FILE LABEL
====================================================== */

function getFileTypeLabel(file) {

  if (isGIF(file)) {
    return "GIF متحرك";
  }

  if (isVideo(file)) {
    return "فيديو";
  }

  return "صورة";

}


/* ======================================================
   CREATE SQUARE CANVAS
====================================================== */

function createSquareCanvas(
  source,
  size = SIZE
) {

  const canvas =
    document.createElement("canvas");

  canvas.width =
    size;

  canvas.height =
    size;

  const ctx =
    canvas.getContext("2d", {
      alpha: true
    });


  ctx.clearRect(
    0,
    0,
    size,
    size
  );


  const sourceWidth =
    source.videoWidth ||
    source.naturalWidth ||
    source.width;

  const sourceHeight =
    source.videoHeight ||
    source.naturalHeight ||
    source.height;


  if (
    !sourceWidth ||
    !sourceHeight
  ) {

    throw new Error(
      "تعذر معرفة أبعاد الملف."
    );

  }


  const scale =
    Math.max(
      size / sourceWidth,
      size / sourceHeight
    );


  const width =
    sourceWidth * scale;

  const height =
    sourceHeight * scale;


  const x =
    (size - width) / 2;

  const y =
    (size - height) / 2;


  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    "high";


  ctx.drawImage(
    source,
    x,
    y,
    width,
    height
  );


  return canvas;

}


/* ======================================================
   CANVAS -> RGBA
====================================================== */

function canvasToRGBA(canvas) {

  const ctx =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );


  return ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  ).data;

}


/* ======================================================
   ENCODE STATIC WEBP
====================================================== */

async function encodeStaticCanvas(
  canvas,
  quality
) {

  const rgba =
    canvasToRGBA(canvas);


  const result =
    await encodeRGBA(
      rgba,
      canvas.width,
      canvas.height,
      true,
      {
        lossless: 0,
        quality
      }
    );


  if (!result) {

    throw new Error(
      "تعذر إنشاء WebP."
    );

  }


  return new Blob(
    [result],
    {
      type: "image/webp"
    }
  );

}


/* ======================================================
   LOAD IMAGE
====================================================== */

function loadImage(file) {

  return new Promise(
    (resolve, reject) => {

      const url =
        URL.createObjectURL(file);

      const img =
        new Image();


      img.onload = () => {

        URL.revokeObjectURL(
          url
        );

        resolve(img);

      };


      img.onerror = () => {

        URL.revokeObjectURL(
          url
        );

        reject(
          new Error(
            `تعذر فتح الصورة: ${file.name}`
          )
        );

      };


      img.src =
        url;

    }
  );

}


/* ======================================================
   STATIC IMAGE -> WEBP
====================================================== */

async function makeStaticSticker(
  file
) {

  const img =
    await loadImage(file);


  let canvas =
    createSquareCanvas(
      img,
      SIZE
    );


  const qualities = [
    90,
    80,
    70,
    60,
    50,
    40,
    30,
    20,
    10,
    1
  ];


  for (
    const quality of qualities
  ) {

    const blob =
      await encodeStaticCanvas(
        canvas,
        quality
      );


    if (
      blob.size <=
      STATIC_MAX
    ) {

      return {
        blob,
        animated: false
      };

    }

  }


  /*
   * If 512×512 still exceeds 100KB,
   * encode a smaller source and scale it back.
   */

  const fallbackSizes = [
    448,
    384,
    320,
    256,
    224,
    192
  ];


  for (
    const smallSize
    of fallbackSizes
  ) {

    canvas =
      createSquareCanvas(
        img,
        smallSize
      );


    for (
      const quality of [
        40,
        30,
        20,
        10,
        1
      ]
    ) {

      const blob =
        await encodeStaticCanvas(
          canvas,
          quality
        );


      if (
        blob.size <=
        STATIC_MAX
      ) {

        /*
         * The sticker file itself remains
         * the encoded small WebP.
         *
         * WhatsApp-compatible sticker
         * dimensions may still require
         * 512×512, so try final resize.
         */

        const finalCanvas =
          document.createElement(
            "canvas"
          );

        finalCanvas.width =
          SIZE;

        finalCanvas.height =
          SIZE;


        const ctx =
          finalCanvas.getContext(
            "2d"
          );


        ctx.imageSmoothingEnabled =
          true;

        ctx.imageSmoothingQuality =
          "high";


        const bitmap =
          await createImageBitmap(
            blob
          );


        ctx.drawImage(
          bitmap,
          0,
          0,
          SIZE,
          SIZE
        );


        bitmap.close();


        for (
          const finalQuality of [
            30,
            20,
            10,
            1
          ]
        ) {

          const finalBlob =
            await encodeStaticCanvas(
              finalCanvas,
              finalQuality
            );


          if (
            finalBlob.size <=
            STATIC_MAX
          ) {

            return {
              blob: finalBlob,
              animated: false
            };

          }

        }

      }

    }

  }


  throw new Error(
    `تعذر ضغط الصورة ${file.name} تحت 100KB.`
  );

}


/* ======================================================
   GIF DECODER
====================================================== */

async function decodeGIF(file) {

  const buffer =
    await file.arrayBuffer();


  const gif =
    parseGIF(buffer);


  const frames =
    decompressFrames(
      gif,
      true
    );


  if (
    !frames ||
    !frames.length
  ) {

    throw new Error(
      `ملف GIF فارغ: ${file.name}`
    );

  }


  return {
    gif,
    frames
  };

}


/* ======================================================
   GIF -> FULL FRAMES
====================================================== */

function gifFramesToRGBA(
  gif,
  frames
) {

  const width =
    gif.lsd.width;

  const height =
    gif.lsd.height;


  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    width;

  canvas.height =
    height;


  const ctx =
    canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const output = [];


  let previous =
    null;


  for (
    let i = 0;
    i < frames.length;
    i++
  ) {

    const frame =
      frames[i];


    /*
     * Apply disposal of previous frame.
     */

    if (previous) {

      if (
        previous.frame.disposalType ===
        2
      ) {

        const d =
          previous.frame.dims;


        ctx.clearRect(
          d.left,
          d.top,
          d.width,
          d.height
        );

      }


      if (
        previous.frame.disposalType ===
        3 &&
        previous.restoreCanvas
      ) {

        ctx.putImageData(
          previous.restoreCanvas,
          0,
          0
        );

      }

    }


    let restoreCanvas =
      null;


    if (
      frame.disposalType ===
      3
    ) {

      restoreCanvas =
        ctx.getImageData(
          0,
          0,
          width,
          height
        );

    }


    const patchCanvas =
      document.createElement(
        "canvas"
      );


    patchCanvas.width =
      frame.dims.width;

    patchCanvas.height =
      frame.dims.height;


    const patchCtx =
      patchCanvas.getContext(
        "2d"
      );


    const patchImage =
      new ImageData(
        new Uint8ClampedArray(
          frame.patch
        ),
        frame.dims.width,
        frame.dims.height
      );


    patchCtx.putImageData(
      patchImage,
      0,
      0
    );


    ctx.drawImage(
      patchCanvas,
      frame.dims.left,
      frame.dims.top
    );


    const full =
      ctx.getImageData(
        0,
        0,
        width,
        height
      );


    output.push({

      data:
        new Uint8Array(
          full.data
        ),

      duration:
        Math.max(
          MIN_FRAME_MS,
          Number(frame.delay) || 100
        )

    });


    previous = {

      frame,

      restoreCanvas

    };

  }


  return {
    width,
    height,
    frames: output
  };

}


/* ======================================================
   RESIZE RGBA -> 512
====================================================== */

function resizeRGBAFrame(
  rgba,
  sourceWidth,
  sourceHeight
) {

  const sourceCanvas =
    document.createElement(
      "canvas"
    );


  sourceCanvas.width =
    sourceWidth;

  sourceCanvas.height =
    sourceHeight;


  const sourceCtx =
    sourceCanvas.getContext(
      "2d"
    );


  sourceCtx.putImageData(
    new ImageData(
      new Uint8ClampedArray(
        rgba
      ),
      sourceWidth,
      sourceHeight
    ),
    0,
    0
  );


  const outputCanvas =
    createSquareCanvas(
      sourceCanvas,
      SIZE
    );


  return canvasToRGBA(
    outputCanvas
  );

}


/* ======================================================
   LIMIT ANIMATION
====================================================== */

function limitAnimationDuration(
  frames
) {

  let total =
    frames.reduce(
      (sum, frame) =>
        sum + frame.duration,
      0
    );


  if (
    total <=
    MAX_ANIMATION_MS
  ) {

    return frames;

  }


  const result = [];

  let elapsed = 0;


  for (
    const frame of frames
  ) {

    if (
      elapsed >=
      MAX_ANIMATION_MS
    ) {
      break;
    }


    const remaining =
      MAX_ANIMATION_MS -
      elapsed;


    const duration =
      Math.min(
        frame.duration,
        remaining
      );


    result.push({

      data:
        frame.data,

      duration:
        Math.max(
          MIN_FRAME_MS,
          duration
        )

    });


    elapsed +=
      duration;

  }


  return result;

}


/* ======================================================
   REDUCE FRAMES
====================================================== */

function reduceFrames(
  frames
) {

  if (
    frames.length <=
    MAX_FRAMES
  ) {

    return frames;

  }


  const step =
    frames.length /
    MAX_FRAMES;


  const result = [];


  for (
    let i = 0;
    i < MAX_FRAMES;
    i++
  ) {

    const index =
      Math.floor(
        i * step
      );


    const frame =
      frames[index];


    result.push({

      data:
        frame.data,

      duration:
        frame.duration * step

    });

  }


  return result;

}


/* ======================================================
   ENCODE ANIMATED WEBP
====================================================== */

async function encodeAnimatedWebP(
  frames
) {

  const qualities = [
    70,
    60,
    50,
    40,
    30,
    20,
    10
  ];


  for (
    const quality of qualities
  ) {

    const configured =
      frames.map(
        frame => ({

          data:
            frame.data,

          duration:
            Math.max(
              MIN_FRAME_MS,
              Math.round(
                frame.duration
              )
            ),

          config: {

            lossless: 0,

            quality

          }

        })
      );


    const result =
      await encodeAnimation(
        SIZE,
        SIZE,
        true,
        configured
      );


    if (!result) {
      continue;
    }


    const blob =
      new Blob(
        [result],
        {
          type:
            "image/webp"
        }
      );


    if (
      blob.size <=
      ANIMATED_MAX
    ) {

      return blob;

    }

  }


  /*
   * Try fewer frames.
   */

  if (
    frames.length > 12
  ) {

    const reduced =
      frames.filter(
        (_, index) =>
          index % 2 === 0
      );


    return encodeAnimatedWebP(
      reduced
    );

  }


  throw new Error(
    "تعذر ضغط الملصق المتحرك تحت 500KB."
  );

}


/* ======================================================
   GIF -> ANIMATED WEBP
====================================================== */

async function makeAnimatedGIF(
  file
) {

  const decoded =
    await decodeGIF(file);


  let frames =
    gifFramesToRGBA(
      decoded.gif,
      decoded.frames
    );


  frames =
    limitAnimationDuration(
      frames
    );


  frames =
    reduceFrames(
      frames
    );


  const resized =
    frames.map(
      frame => ({

        data:
          resizeRGBAFrame(
            frame.data,
            decoded.width,
            decoded.height
          ),

        duration:
          frame.duration

      })
    );


  const blob =
    await encodeAnimatedWebP(
      resized
    );


  return {

    blob,

    animated:
      true

  };

}


/* ======================================================
   VIDEO LOAD
====================================================== */

function loadVideo(file) {

  return new Promise(
    (resolve, reject) => {

      const url =
        URL.createObjectURL(file);


      const video =
        document.createElement(
          "video"
        );


      video.muted =
        true;

      video.playsInline =
        true;

      video.preload =
        "metadata";

      video.src =
        url;


      const cleanup =
        () => {

          URL.revokeObjectURL(
            url
          );

        };


      video.onloadedmetadata =
        () => {

          resolve({
            video,
            cleanup
          });

        };


      video.onerror =
        () => {

          cleanup();

          reject(
            new Error(
              `تعذر فتح الفيديو: ${file.name}`
            )
          );

        };

    }
  );

}


/* ======================================================
   VIDEO -> FRAMES
====================================================== */

async function extractVideoFrames(
  file
) {

  const loaded =
    await loadVideo(file);


  const video =
    loaded.video;


  const duration =
    Number(video.duration);


  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {

    loaded.cleanup();

    throw new Error(
      `تعذر معرفة مدة الفيديو: ${file.name}`
    );

  }


  const usableDuration =
    Math.min(
      duration,
      MAX_ANIMATION_MS / 1000
    );


  const totalFrames =
    Math.min(
      MAX_FRAMES,
      Math.max(
        1,
        Math.ceil(
          usableDuration *
          VIDEO_FPS
        )
      )
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    SIZE;

  canvas.height =
    SIZE;


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    "high";


  const frames = [];


  for (
    let i = 0;
    i < totalFrames;
    i++
  ) {

    const time =
      totalFrames === 1
        ? 0
        : (
            i /
            (totalFrames - 1)
          ) *
          usableDuration;


    await seekVideo(
      video,
      time
    );


    ctx.clearRect(
      0,
      0,
      SIZE,
      SIZE
    );


    const sourceWidth =
      video.videoWidth;

    const sourceHeight =
      video.videoHeight;


    const scale =
      Math.max(
        SIZE / sourceWidth,
        SIZE / sourceHeight
      );


    const width =
      sourceWidth * scale;

    const height =
      sourceHeight * scale;


    const x =
      (SIZE - width) / 2;

    const y =
      (SIZE - height) / 2;


    ctx.drawImage(
      video,
      x,
      y,
      width,
      height
    );


    const image =
      ctx.getImageData(
        0,
        0,
        SIZE,
        SIZE
      );


    frames.push({

      data:
        new Uint8Array(
          image.data
        ),

      duration:
        1000 / VIDEO_FPS

    });

  }


  loaded.cleanup();


  return frames;

}


/* ======================================================
   SEEK VIDEO
====================================================== */

function seekVideo(
  video,
  time
) {

  return new Promise(
    (resolve, reject) => {

      if (
        Math.abs(
          video.currentTime -
          time
        ) < 0.001
      ) {

        resolve();

        return;

      }


      const onSeeked =
        () => {

          cleanup();

          resolve();

        };


      const onError =
        () => {

          cleanup();

          reject(
            new Error(
              "تعذر قراءة إطار من الفيديو."
            )
          );

        };


      const cleanup =
        () => {

          video.removeEventListener(
            "seeked",
            onSeeked
          );

          video.removeEventListener(
            "error",
            onError
          );

        };


      video.addEventListener(
        "seeked",
        onSeeked,
        {
          once: true
        }
      );


      video.addEventListener(
        "error",
        onError,
        {
          once: true
        }
      );


      try {

        video.currentTime =
          Math.max(
            0,
            time
          );

      } catch (error) {

        cleanup();

        reject(error);

      }

    }
  );

}


/* ======================================================
   VIDEO -> ANIMATED WEBP
====================================================== */

async function makeVideoSticker(
  file
) {

  const frames =
    await extractVideoFrames(
      file
    );


  if (
    !frames.length
  ) {

    throw new Error(
      `الفيديو لا يحتوي على إطارات: ${file.name}`
    );

  }


  const blob =
    await encodeAnimatedWebP(
      frames
    );


  return {

    blob,

    animated:
      true

  };

}


/* ======================================================
   CREATE COVER
====================================================== */

async function createCover() {

  const first =
    generatedStickers[0];


  if (!first) {

    throw new Error(
      "لا توجد ملصقات لإنشاء الغلاف."
    );

  }


  /*
   * Use the first generated WebP.
   * This avoids decoding the original file again.
   */

  const bitmap =
    await createImageBitmap(
      first.blob
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    COVER_SIZE;

  canvas.height =
    COVER_SIZE;


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.drawImage(
    bitmap,
    0,
    0,
    COVER_SIZE,
    COVER_SIZE
  );


  bitmap.close();


  return canvasToPNG(
    canvas
  );

}


/* ======================================================
   CANVAS -> PNG
====================================================== */

function canvasToPNG(
  canvas
) {

  return new Promise(
    (resolve, reject) => {

      canvas.toBlob(
        blob => {

          if (!blob) {

            reject(
              new Error(
                "تعذر إنشاء الغلاف."
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


/* ======================================================
   BUILD PACK
====================================================== */

async function buildPack() {

  const name =
    packNameInput.value.trim() ||
    "Miku Stickers";


  const cover =
    await createCover();


  return {

    name,

    publisher:
      "Miku Stickers",

    identifier:
      `com.miku.stickers.${Date.now()}`,

    cover,

    stickers:
      generatedStickers

  };

}


/* ======================================================
   BUILD .WASTICKERS
====================================================== */

async function createWastickers() {

  if (
    !generatedPack ||
    !generatedStickers.length
  ) {

    throw new Error(
      "أنشئ الحزمة أولًا."
    );

  }


  if (
    typeof JSZip ===
    "undefined"
  ) {

    throw new Error(
      "JSZip غير محملة."
    );

  }


  const zip =
    new JSZip();


  zip.file(
    "title.txt",
    generatedPack.name
  );


  zip.file(
    "author.txt",
    generatedPack.publisher
  );


  zip.file(
    "cover.png",
    generatedPack.cover
  );


  for (
    let i = 0;
    i < generatedStickers.length;
    i++
  ) {

    zip.file(
      `${i}.webp`,
      generatedStickers[i].blob
    );

  }


  return zip.generateAsync({

    type:
      "blob",

    compression:
      "DEFLATE",

    compressionOptions: {

      level:
        6

    }

  });

}


/* ======================================================
   SHARE
====================================================== */

async function shareFile(
  blob
) {

  const packName =
    generatedPack?.name ||
    "Miku Stickers";


  const safeName =
    packName
      .replace(
        /[\\/:*?"<>|]/g,
        ""
      )
      .trim() ||
    "Miku Stickers";


  const file =
    new File(
      [blob],
      `${safeName}.wastickers`,
      {
        type:
          "application/octet-stream"
      }
    );


  if (
    navigator.share &&
    navigator.canShare
  ) {

    try {

      const supported =
        navigator.canShare({
          files: [file]
        });


      if (supported) {

        await navigator.share({

          title:
            safeName,

          text:
            "Miku Stickers",

          files: [
            file
          ]

        });

        return;

      }

    } catch (error) {

      if (
        error?.name ===
        "AbortError"
      ) {

        return;

      }


      console.warn(
        "Share failed:",
        error
      );

    }

  }


  downloadFile(
    blob,
    `${safeName}.wastickers`
  );

}


/* ======================================================
   DOWNLOAD
====================================================== */

function downloadFile(
  blob,
  filename
) {

  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;

  link.download =
    filename;

  link.style.display =
    "none";


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        url
      );

    },
    3000
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


      const number =
        document.createElement(
          "div"
        );


      number.className =
        "sticker-number";

      number.textContent =
        `#${index + 1}`;


      const size =
        document.createElement(
          "div"
        );


      size.className =
        "sticker-size";

      size.textContent =
        formatBytes(
          file.size
        );


      const type =
        document.createElement(
          "div"
        );


      type.className =
        "sticker-type";

      type.textContent =
        getFileTypeLabel(
          file
        );


      const url =
        URL.createObjectURL(
          file
        );


      img.src =
        url;


      img.onload =
        () => {

          URL.revokeObjectURL(
            url
          );

        };


      img.onerror =
        () => {

          /*
           * Video thumbnails cannot always
           * be displayed as <img>.
           */

          URL.revokeObjectURL(
            url
          );


          if (
            isVideo(file)
          ) {

            const video =
              document.createElement(
                "video"
              );


            const videoUrl =
              URL.createObjectURL(
                file
              );


            video.src =
              videoUrl;

            video.muted =
              true;

            video.playsInline =
              true;

            video.preload =
              "metadata";

            video.controls =
              false;

            video.loop =
              true;


            video.style.width =
              "100%";

            video.style.height =
              "100%";

            video.style.objectFit =
              "cover";


            video.onloadeddata =
              () => {

                video.currentTime =
                  0;

                video.play()
                  .catch(
                    () => {}
                  );

              };


            video.onloadedmetadata =
              () => {

                URL.revokeObjectURL(
                  videoUrl
                );

              };


            card.replaceChild(
              video,
              img
            );

          }

        };


      card.appendChild(
        img
      );

      card.appendChild(
        number
      );

      card.appendChild(
        size
      );

      card.appendChild(
        type
      );


      preview.appendChild(
        card
      );

    }
  );

}


/* ======================================================
   FILE INPUT
====================================================== */

fileInput.addEventListener(
  "change",
  async () => {

    const files =
      Array.from(
        fileInput.files || []
      );


    selectedFiles =
      [];

    generatedStickers =
      [];

    generatedPack =
      null;


    whatsappButton.disabled =
      true;


    if (
      files.length <
        MIN_STICKERS ||
      files.length >
        MAX_STICKERS
    ) {

      preview.innerHTML =
        "";

      createButton.disabled =
        true;


      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف.`
      );


      return;

    }


    /*
     * Accept images + GIF + video.
     */

    const unsupported =
      files.filter(
        file =>
          !isImage(file) &&
          !isGIF(file) &&
          !isVideo(file)
      );


    if (
      unsupported.length
    ) {

      createButton.disabled =
        true;


      setStatus(
        `يوجد ملف غير مدعوم: ${unsupported[0].name}`
      );


      return;

    }


    selectedFiles =
      files;


    renderPreview();


    createButton.disabled =
      false;


    const imageCount =
      files.filter(
        file => isImage(file)
      ).length;


    const gifCount =
      files.filter(
        file => isGIF(file)
      ).length;


    const videoCount =
      files.filter(
        file => isVideo(file)
      ).length;


    setStatus(
      `تم اختيار ${files.length} ملف: ${imageCount} صورة، ${gifCount} GIF، ${videoCount} فيديو.`
    );


    bridgeStatus.textContent =
      "الصور وGIF والفيديو مدعومة.";

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
        MIN_STICKERS ||
      selectedFiles.length >
        MAX_STICKERS
    ) {

      setStatus(
        `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف.`
      );

      return;

    }


    createButton.disabled =
      true;

    whatsappButton.disabled =
      true;


    generatedStickers =
      [];


    generatedPack =
      null;


    try {

      for (
        let i = 0;
        i < selectedFiles.length;
        i++
      ) {

        const file =
          selectedFiles[i];


        setStatus(
          `جاري تحويل ${i + 1} من ${selectedFiles.length}: ${getFileTypeLabel(file)}...`
        );


        let result;


        if (
          isGIF(file)
        ) {

          result =
            await makeAnimatedGIF(
              file
            );

        } else if (
          isVideo(file)
        ) {

          result =
            await makeVideoSticker(
              file
            );

        } else {

          result =
            await makeStaticSticker(
              file
            );

        }


        generatedStickers.push({

          index:
            i,

          blob:
            result.blob,

          animated:
            result.animated

        });


        const cards =
          preview.querySelectorAll(
            ".sticker-card"
          );


        const card =
          cards[i];


        if (card) {

          const size =
            card.querySelector(
              ".sticker-size"
            );


          const type =
            card.querySelector(
              ".sticker-type"
            );


          if (size) {

            size.textContent =
              formatBytes(
                result.blob.size
              );

          }


          if (type) {

            type.textContent =
              result.animated
                ? "Animated WebP"
                : "WebP";

          }

        }

      }


      setStatus(
        "جاري تجهيز الحزمة..."
      );


      generatedPack =
        await buildPack();


      whatsappButton.disabled =
        false;


      bridgeStatus.textContent =
        "الحزمة جاهزة للمشاركة.";


      setStatus(
        `تم تجهيز ${generatedStickers.length} ملصق بنجاح.`
      );


    } catch (error) {

      console.error(
        error
      );


      generatedStickers =
        [];

      generatedPack =
        null;


      whatsappButton.disabled =
        true;


      bridgeStatus.textContent =
        "حدث خطأ أثناء التحويل.";


      setStatus(
        error?.message ||
        "حدث خطأ غير معروف."
      );


    } finally {

      createButton.disabled =
        false;

    }

  }
);


/* ======================================================
   SHARE BUTTON
====================================================== */

whatsappButton.addEventListener(
  "click",
  async () => {

    if (
      !generatedPack
    ) {

      setStatus(
        "أنشئ الحزمة أولًا."
      );

      return;

    }


    whatsappButton.disabled =
      true;


    try {

      setStatus(
        "جاري إنشاء ملف .wastickers..."
      );


      bridgeStatus.textContent =
        "جاري ضغط الحزمة...";


      const blob =
        await createWastickers();


      bridgeStatus.textContent =
        "جاري فتح المشاركة...";


      await shareFile(
        blob
      );


      bridgeStatus.textContent =
        "تم تجهيز الحزمة للمشاركة.";


      setStatus(
        "اختر التطبيق المناسب من قائمة المشاركة."
      );


    } catch (error) {

      console.error(
        error
      );


      bridgeStatus.textContent =
        "تعذر مشاركة الحزمة.";


      setStatus(
        error?.message ||
        "حدث خطأ أثناء المشاركة."
      );


    } finally {

      whatsappButton.disabled =
        false;

    }

  }
);


/* ======================================================
   INITIAL STATE
====================================================== */

createButton.disabled =
  true;

whatsappButton.disabled =
  true;


bridgeStatus.textContent =
  "Miku Stickers جاهز.";


setStatus(
  `اختر من ${MIN_STICKERS} إلى ${MAX_STICKERS} ملف.`
);


console.log(
  "MIKU STICKERS: app loaded successfully"
);
