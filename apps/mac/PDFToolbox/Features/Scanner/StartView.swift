import ScanSession
import SwiftUI

struct StartView: View {
    @Environment(ScannerSession.self) private var session
    @State private var targeted = false
    var choosePhotos: () -> Void

    var body: some View {
        VStack(spacing: 28) {
            VStack(spacing: 18) {
                Image(Brand.scannerMonk)
                    .resizable()
                    .scaledToFit()
                    .frame(height: 110)
                    .accessibilityHidden(true)
                Text("Drop your document photos 📸")
                    .font(.brandTitle(34))
                Text("HEIC, JPEG or PNG. Everything runs on this Mac: nothing is sent.")
                    .foregroundStyle(.secondary)
                Button("Choose Photos…", action: choosePhotos)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .buttonHover()
            }
            .frame(width: 760, height: 380)
            .background(targeted ? Color.accentColor.opacity(0.08) : Color.clear, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(targeted ? Color.accentColor : Color.secondary.opacity(0.5),
                                                                      style: StrokeStyle(lineWidth: 2, dash: [8, 6])))
            .dropDestination(for: URL.self) { urls, _ in
                session.add(urls)
                return !urls.isEmpty
            } isTargeted: { targeted = $0 }

            HStack(alignment: .top, spacing: 16) {
                Step(number: 1, title: "Straighten", text: "The page is found, cropped and flattened. You can still move its corners.")
                Step(number: 2, title: "Clean", text: "Shadows removed, white paper, black text. Stamps and signatures keep their color.")
                Step(number: 3, title: "Documents", text: "Text recognition suggests how to group and name the pages. You confirm, one PDF per document.")
            }
            .frame(width: 760)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct Step: View {
    let number: Int
    let title: LocalizedStringKey
    let text: LocalizedStringKey

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 0) {
                Text(verbatim: "\(number) · ")
                Text(title)
            }
            .font(.callout.weight(.semibold))
            .foregroundStyle(.tint)
            Text(text).font(.callout).foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(.background, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(.separator))
    }
}
