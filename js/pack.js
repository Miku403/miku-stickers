import {
  blobToBase64
} from "./utils.js";


export async function createPack(
  packName,
  stickers
) {

  if (
    stickers.length < 3 ||
    stickers.length > 30
  ) {

    throw new Error(
      "يجب اختيار من 3 إلى 30 ملصقًا"
    );

  }


  const trayImage =
    await blobToBase64(
      stickers[0].blob
    );


  return {

    ios_app_store_link: "",
    android_play_store_link: "",

    identifier:
      "miku_stickers_" +
      Date.now(),

    name:
      packName.trim() ||
      "Miku Stickers",

    publisher:
      "Miku Stickers",

    tray_image:
      trayImage,

    stickers:
      stickers.map(
        (sticker, index) => ({

          image_data:
            sticker.base64,

          emojis: ["😀"],

          accessibility_text:
            `Miku Sticker ${index + 1}`

        })
      )

  };
}
