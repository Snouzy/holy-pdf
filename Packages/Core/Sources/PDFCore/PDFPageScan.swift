import CoreGraphics
import Foundation

/// What PDFKit does not say about a page, read from its content: the font of each piece of text, and where its
/// pictures stand. PDFKit names « Helvetica » every font the Mac does not have.
struct PageScan {
    struct Face: Equatable {
        /// A family that Word knows, when the font has one.
        var family: String
        var bold: Bool
        var italic: Bool

        /// « ABCDEF+TimesNewRomanPSMT-Bold » is Times New Roman, bold: Word looks a font up by its family.
        init(postScript name: String, flags: Int = 0, weight: Int = 0) {
            let bare = name.replacingOccurrences(of: "^[A-Z]{6}\\+", with: "", options: .regularExpression)
            func has(_ pattern: String) -> Bool { bare.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil }
            var base = String(bare.split { $0 == "-" || $0 == "," }.first ?? "")
            if let suffix = ["PSMT", "PS", "MT"].first(where: base.hasSuffix) { base.removeLast(suffix.count) }
            let known = ["Helvetica": "Arial", "Arial": "Arial", "Times": "Times New Roman", "TimesNewRoman": "Times New Roman",
                         "Courier": "Courier New", "CourierNew": "Courier New",
                         "NimbusRomNo9L": "Times New Roman", "NimbusSanL": "Arial", "NimbusMonL": "Courier New"]
            let spaced = base.replacingOccurrences(of: "([a-z])([A-Z])", with: "$1 $2", options: .regularExpression)
            family = known[base] ?? (spaced.isEmpty ? "Arial" : spaced)
            // The standard fonts declare no weight and no flag: the name is the first witness. « -Medi » is the bold of
            // the fonts LaTeX embeds (a « Medium » is not bold), and « CMBX », « CMTI » are its own.
            bold = has("bold|black|heavy|semibold|demi|-medi(ital)?$|^cmbx") || weight >= 600
            italic = has("italic|oblique|-(regu|medi|bold)?ital$|^cmti|^cmsl") || flags & 64 != 0
        }
    }

    /// Where a piece of text starts, in page space, and its font.
    struct Start {
        let origin: CGPoint
        let face: Face
    }

    struct Picture {
        /// Where the picture shows, in page space: its place, cut by the clip.
        let frame: CGRect
        /// The unit square under this matrix is where the picture is laid, whatever the clip hides.
        let matrix: CGAffineTransform
        /// The image of the document, or nil for a picture written in the content itself.
        let stream: CGPDFStreamRef?
    }

    /// The pictures in the order the page draws them.
    let pictures: [Picture]
    /// By rounded height of the baseline.
    private let starts: [Int: [Start]]

    init() {
        pictures = []
        starts = [:]
    }

    init(_ page: CGPDFPage) {
        let reading = Reading()
        reading.table = Self.operators()
        let content = CGPDFContentStreamCreateWithPage(page)
        let scanner = CGPDFScannerCreate(content, reading.table, Unmanaged.passUnretained(reading).toOpaque())
        CGPDFScannerScan(scanner)
        CGPDFScannerRelease(scanner)
        CGPDFContentStreamRelease(content)
        if let table = reading.table { CGPDFOperatorTableRelease(table) }
        pictures = reading.pictures
        starts = Dictionary(grouping: reading.starts) { Int($0.origin.y.rounded()) }
    }

    /// The pieces of text that start on the line whose box is `bounds`, in page space, from left to right. None for a
    /// line that is not horizontal.
    func starts(onLine bounds: CGRect) -> [Start] {
        guard bounds.minY.isFinite, bounds.height.isFinite, abs(bounds.minY) < Self.farthest, bounds.height >= 0, bounds.height < Self.farthest else { return [] }
        // The baseline lies between the bottom of the box and its middle.
        let band = (bounds.minY - 1)...(bounds.minY + bounds.height / 2)
        var found: [Start] = []
        for key in Int(band.lowerBound.rounded(.down))...Int(band.upperBound.rounded(.up)) {
            found += (starts[key] ?? []).filter { band.contains($0.origin.y) && $0.origin.x >= bounds.minX - 2 && $0.origin.x <= bounds.maxX }
        }
        return found.sorted { $0.origin.x < $1.origin.x }
    }

    /// Farther than any page goes, in points. A matrix can send a point beyond what a whole number holds.
    private static let farthest: CGFloat = 1_000_000

    private final class Reading {
        /// What « q » saves and « Q » restores.
        struct Graphics {
            var matrix = CGAffineTransform.identity
            /// The rectangle that clips what is drawn, in page space. Nil when nothing clips, or when the clip is no rectangle.
            var clip: CGRect?
            var face: Face?
        }

        var table: CGPDFOperatorTableRef?
        var states = [Graphics()]
        var text = CGAffineTransform.identity
        var line = CGAffineTransform.identity
        var leading: CGFloat = 0
        /// False once a piece of text was shown: the pen moved by the widths of its letters, which are in the font.
        var placed = false
        /// The rectangle of the path being built, when the path is one rectangle.
        var path: CGRect?
        var pathIsRectangle = true
        /// The forms being read, outermost first: one that draws itself is read once.
        var forms: [CGPDFStreamRef] = []
        var formsRead = 0
        var starts: [Start] = []
        var pictures: [Picture] = []

        var graphics: Graphics {
            get { states[states.count - 1] }
            set { states[states.count - 1] = newValue }
        }

        func moveLine(_ step: CGAffineTransform) {
            line = step.concatenating(line)
            text = line
            placed = true
        }

        func show() {
            defer { placed = false }
            let origin = CGPoint(x: text.tx, y: text.ty).applying(graphics.matrix)
            guard placed, let face = graphics.face, starts.count < 200_000,
                  origin.x.isFinite, origin.y.isFinite, abs(origin.x) < PageScan.farthest, abs(origin.y) < PageScan.farthest else { return }
            starts.append(Start(origin: origin, face: face))
        }

        /// A picture fills the unit square of the space it is drawn in, as far as the clip lets it show.
        func picture(_ stream: CGPDFStreamRef?) {
            let placed = CGRect(x: 0, y: 0, width: 1, height: 1).applying(graphics.matrix)
            var frame = placed
            if let clip = graphics.clip { frame = frame.intersection(clip) }
            let numbers = [frame.minX, frame.minY, frame.width, frame.height, placed.minX, placed.minY, placed.width, placed.height]
            guard pictures.count < 10_000, !frame.isNull, numbers.allSatisfy({ $0.isFinite && abs($0) < PageScan.farthest }) else { return }
            pictures.append(Picture(frame: frame, matrix: graphics.matrix, stream: stream))
        }
    }

    private static func reading(_ info: UnsafeMutableRawPointer?) -> Reading? {
        info.map { Unmanaged<Reading>.fromOpaque($0).takeUnretainedValue() }
    }

    private static func number(_ scanner: CGPDFScannerRef) -> CGFloat {
        var value: CGPDFReal = 0
        CGPDFScannerPopNumber(scanner, &value)
        return value
    }

    /// The six numbers of a matrix, which the scanner gives last first.
    private static func matrix(_ scanner: CGPDFScannerRef) -> CGAffineTransform {
        let ty = number(scanner), tx = number(scanner), d = number(scanner), c = number(scanner), b = number(scanner), a = number(scanner)
        return CGAffineTransform(a: a, b: b, c: c, d: d, tx: tx, ty: ty)
    }

    private static func dictionary(_ object: CGPDFObjectRef?) -> CGPDFDictionaryRef? {
        var result: CGPDFDictionaryRef?
        guard let object, CGPDFObjectGetValue(object, .dictionary, &result) else { return nil }
        return result
    }

    private static func operators() -> CGPDFOperatorTableRef? {
        guard let table = CGPDFOperatorTableCreate() else { return nil }
        CGPDFOperatorTableSetCallback(table, "q") { _, info in
            if let state = PageScan.reading(info), state.states.count < 256 { state.states.append(state.graphics) }
        }
        CGPDFOperatorTableSetCallback(table, "Q") { _, info in
            if let state = PageScan.reading(info), state.states.count > 1 { state.states.removeLast() }
        }
        CGPDFOperatorTableSetCallback(table, "cm") { scanner, info in
            guard let state = PageScan.reading(info) else { return }
            state.graphics.matrix = PageScan.matrix(scanner).concatenating(state.graphics.matrix)
        }
        // A path made of one rectangle, then « W »: what is drawn after shows inside that rectangle only.
        CGPDFOperatorTableSetCallback(table, "re") { scanner, info in
            let height = PageScan.number(scanner), width = PageScan.number(scanner), y = PageScan.number(scanner), x = PageScan.number(scanner)
            guard let state = PageScan.reading(info) else { return }
            state.pathIsRectangle = state.pathIsRectangle && state.path == nil
            state.path = CGRect(x: x, y: y, width: width, height: height).standardized.applying(state.graphics.matrix)
        }
        for name in ["m", "l", "c", "v", "y", "h"] {
            CGPDFOperatorTableSetCallback(table, name) { _, info in PageScan.reading(info)?.pathIsRectangle = false }
        }
        for name in ["W", "W*"] {
            CGPDFOperatorTableSetCallback(table, name) { _, info in
                guard let state = PageScan.reading(info), state.pathIsRectangle, let path = state.path else { return }
                state.graphics.clip = state.graphics.clip.map { $0.intersection(path) } ?? path
            }
        }
        for name in ["n", "S", "s", "f", "F", "f*", "B", "B*", "b", "b*"] {
            CGPDFOperatorTableSetCallback(table, name) { _, info in
                PageScan.reading(info)?.path = nil
                PageScan.reading(info)?.pathIsRectangle = true
            }
        }
        CGPDFOperatorTableSetCallback(table, "BT") { _, info in
            PageScan.reading(info)?.line = .identity
            PageScan.reading(info)?.moveLine(.identity)
        }
        CGPDFOperatorTableSetCallback(table, "Tm") { scanner, info in
            guard let state = PageScan.reading(info) else { return }
            state.line = PageScan.matrix(scanner)
            state.moveLine(.identity)
        }
        CGPDFOperatorTableSetCallback(table, "Td") { scanner, info in
            let y = PageScan.number(scanner), x = PageScan.number(scanner)
            PageScan.reading(info)?.moveLine(CGAffineTransform(translationX: x, y: y))
        }
        CGPDFOperatorTableSetCallback(table, "TD") { scanner, info in
            let y = PageScan.number(scanner), x = PageScan.number(scanner)
            PageScan.reading(info)?.leading = -y
            PageScan.reading(info)?.moveLine(CGAffineTransform(translationX: x, y: y))
        }
        CGPDFOperatorTableSetCallback(table, "TL") { scanner, info in PageScan.reading(info)?.leading = PageScan.number(scanner) }
        CGPDFOperatorTableSetCallback(table, "T*") { _, info in
            guard let state = PageScan.reading(info) else { return }
            state.moveLine(CGAffineTransform(translationX: 0, y: -state.leading))
        }
        CGPDFOperatorTableSetCallback(table, "Tf") { scanner, info in
            _ = PageScan.number(scanner)
            var key: UnsafePointer<CChar>?
            // The content stream finds a font where the page, its parents or the form declare it.
            guard let state = PageScan.reading(info), CGPDFScannerPopName(scanner, &key), let key,
                  let font = PageScan.dictionary(CGPDFContentStreamGetResource(CGPDFScannerGetContentStream(scanner), "Font", key)) else { return }
            // A composite font keeps its facts one level down.
            let facts = font.dictionary("FontDescriptor") ?? font.dictionaries("DescendantFonts").first { _ in true }?.dictionary("FontDescriptor")
            var flags = 0, weight = 0
            if let facts {
                CGPDFDictionaryGetInteger(facts, "Flags", &flags)
                CGPDFDictionaryGetInteger(facts, "FontWeight", &weight)
            }
            state.graphics.face = Face(postScript: font.name("BaseFont") ?? "", flags: flags, weight: weight)
        }
        CGPDFOperatorTableSetCallback(table, "Tj") { _, info in PageScan.reading(info)?.show() }
        CGPDFOperatorTableSetCallback(table, "TJ") { _, info in PageScan.reading(info)?.show() }
        // « ' » and « " » go to the next line first, then show their text.
        for name in ["'", "\""] {
            CGPDFOperatorTableSetCallback(table, name) { _, info in
                guard let state = PageScan.reading(info) else { return }
                state.moveLine(CGAffineTransform(translationX: 0, y: -state.leading))
                state.show()
            }
        }
        // A picture written in the content itself, between « BI » and « EI ».
        CGPDFOperatorTableSetCallback(table, "EI") { scanner, info in
            var stream: CGPDFStreamRef?
            CGPDFScannerPopStream(scanner, &stream)
            PageScan.reading(info)?.picture(nil)
        }
        CGPDFOperatorTableSetCallback(table, "Do") { scanner, info in
            var key: UnsafePointer<CChar>?
            var stream: CGPDFStreamRef?
            guard let state = PageScan.reading(info), CGPDFScannerPopName(scanner, &key), let key,
                  let object = CGPDFContentStreamGetResource(CGPDFScannerGetContentStream(scanner), "XObject", key),
                  CGPDFObjectGetValue(object, .stream, &stream), let stream, let facts = CGPDFStreamGetDictionary(stream) else { return }
            if facts.name("Subtype") == "Image" {
                state.picture(stream)
            } else if facts.name("Subtype") == "Form", state.forms.count < 16, state.formsRead < 2_000, !state.forms.contains(stream) {
                var numbers: CGPDFArrayRef?
                var values = [CGPDFReal](repeating: 0, count: 6)
                var own = CGAffineTransform.identity
                if CGPDFDictionaryGetArray(facts, "Matrix", &numbers), let numbers, CGPDFArrayGetCount(numbers) == 6,
                   (0..<6).allSatisfy({ CGPDFArrayGetNumber(numbers, $0, &values[$0]) }) {
                    own = CGAffineTransform(a: values[0], b: values[1], c: values[2], d: values[3], tx: values[4], ty: values[5])
                }
                // A form is drawn between a « q » and a « Q » of its own, and its text starts afresh.
                let (text, line, placed) = (state.text, state.line, state.placed)
                state.states.append(state.graphics)
                state.graphics.matrix = own.concatenating(state.graphics.matrix)
                state.forms.append(stream)
                state.formsRead += 1
                // Without resources of its own, a form finds its fonts through the stream that draws it.
                let content = CGPDFContentStreamCreateWithStream(stream, facts.dictionary("Resources") ?? facts, CGPDFScannerGetContentStream(scanner))
                let inner = CGPDFScannerCreate(content, state.table, info)
                CGPDFScannerScan(inner)
                CGPDFScannerRelease(inner)
                CGPDFContentStreamRelease(content)
                state.forms.removeLast()
                state.states.removeLast()
                (state.text, state.line, state.placed) = (text, line, placed)
            }
        }
        return table
    }
}
