import CoreText
import SwiftUI

/// The Holy PDF brand on the Mac. The drawings and colors come from the site:
/// `apps/web/tests/unit/macAssets.test.ts` writes them into `Assets.xcassets/Generated`.
enum Brand {
    static let titleFont = "BricolageGrotesque96ptExtraBold-ExtraBold"
    static let scannerMonk = "monk-scanner"
    static let scannerScene = "scene-scan"

    /// Without it, titles fall back to the system font.
    static func registerFonts() {
        guard let url = Bundle.main.url(forResource: "BricolageGrotesque-ExtraBold", withExtension: "ttf") else { return }
        CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
    }
}

enum MonkMood: String, CaseIterable {
    case happy, focus, joy, oops

    var image: String { "avatar-scanner-\(rawValue)" }
}

extension Font {
    static func brandTitle(_ size: CGFloat) -> Font {
        .custom(Brand.titleFont, size: size, relativeTo: .largeTitle)
    }
}

/// Brother Snap in his circle.
struct MonkAvatar: View {
    var mood: MonkMood
    var size: CGFloat

    var body: some View {
        Image(mood.image)
            .resizable()
            .scaledToFit()
            .frame(width: size)
            .accessibilityHidden(true)
    }
}

/// A title in the brand font. The **bold** part of the localized text gets the yellow highlighter.
struct HighlightedTitle: View {
    var text: LocalizedStringResource
    var size: CGFloat
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        title
            .font(.brandTitle(size))
            // As on the site: the band covers the bottom of the letters in light mode, the whole word in dark mode.
            .textRenderer(Highlighter(top: colorScheme == .dark ? 0.08 : 0.55))
    }

    private var title: Text {
        let attributed = AttributedString(localized: text)
        return attributed.runs.reduce(Text(verbatim: "")) { title, run in
            let part = Text(verbatim: String(attributed[run.range].characters))
            guard run.inlinePresentationIntent?.contains(.stronglyEmphasized) == true else { return title + part }
            return title + part.customAttribute(Highlighted()).foregroundStyle(Color("OnHighlight"))
        }
    }
}

private struct Highlighted: TextAttribute {}

private struct Highlighter: TextRenderer {
    var top: CGFloat

    func draw(layout: Text.Layout, in context: inout GraphicsContext) {
        for line in layout {
            for run in line where run[Highlighted.self] != nil {
                let bounds = run.typographicBounds.rect
                let band = CGRect(x: bounds.minX - 4, y: bounds.minY + bounds.height * top,
                                  width: bounds.width + 8, height: bounds.height * (0.92 - top))
                context.fill(Path(band), with: .color(Color("Highlight")))
            }
            context.draw(line)
        }
    }
}
