import Foundation
import UIKit

final class WhatsAppBridge {

    static let shared = WhatsAppBridge()

    private init() {}

    func importPack(
        identifier: String,
        name: String,
        publisher: String,
        trayImageBase64: String,
        stickers: [[String: Any]]
    ) throws {

        let pack: [String: Any] = [
            "ios_app_store_link": "",
            "android_play_store_link": "",
            "identifier": identifier,
            "name": name,
            "publisher": publisher,
            "tray_image": trayImageBase64,
            "stickers": stickers
        ]

        guard JSONSerialization.isValidJSONObject(pack) else {
            throw NSError(
                domain: "MikuStickers",
                code: 1,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "بيانات الحزمة غير صالحة"
                ]
            )
        }

        let jsonData = try JSONSerialization.data(
            withJSONObject: pack,
            options: []
        )

        UIPasteboard.general.setItems(
            [[
                "net.whatsapp.third-party.sticker-pack": jsonData
            ]],
            options: [:]
        )

        guard let url = URL(
            string: "whatsapp://stickerPack"
        ) else {
            return
        }

        DispatchQueue.main.async {
            UIApplication.shared.open(
                url,
                options: [:],
                completionHandler: nil
            )
        }
    }
}
