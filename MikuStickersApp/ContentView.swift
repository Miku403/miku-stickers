import SwiftUI
import WebKit

struct ContentView: View {

    var body: some View {
        MikuWebView()
            .ignoresSafeArea()
    }
}

struct MikuWebView: UIViewRepresentable {

    let url = URL(
        string: "https://miku-stickers.vercel.app/"
    )!

    func makeUIView(context: Context) -> WKWebView {

        let configuration = WKWebViewConfiguration()

        let webView = WKWebView(
            frame: .zero,
            configuration: configuration
        )

        webView.allowsBackForwardNavigationGestures = true

        webView.load(
            URLRequest(url: url)
        )

        return webView
    }

    func updateUIView(
        _ webView: WKWebView,
        context: Context
    ) {}

}
