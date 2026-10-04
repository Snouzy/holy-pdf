import CoreGraphics
import Foundation
import PDFKit

/// A Word document with the text of each page, paragraph by paragraph, and its pictures where they stand: the site's
/// rules (`apps/web/src/engine/word.ts`). The text is read in the order PDFKit finds it, and tables become lines of text.
public enum PDFWord {
    /// Points from the top-left corner of the page as the reader sees it.
    private struct Line {
        var runs: [Docx.Run]
        var left: CGFloat
        var right: CGFloat
        /// The bottom of the line: the gap between two lines is measured from one bottom to the next.
        var baseline: CGFloat
        var size: Double
    }

    /// Where a block stands on the page, in points from the top-left corner.
    private struct Placed {
        var top: CGFloat
        var left: CGFloat
        var right: CGFloat
        var block: Docx.Block
    }

    /// Smaller pictures are rules, bullets and dots.
    private static let smallest: CGFloat = 16
    /// A page that has pictures is drawn once at this resolution, and each picture is cut out of it.
    private static let resolution: CGFloat = 200
    private static let bullet = "^\\s*([•▪◦●○■□–—*-]|\\d+[.)])\\s"
    private static let sentenceEnd = "[.!?:;»”\"')\\]]\\s*$"

    /// No copy of the PDF is written: a signed PDF is read like any other.
    public static func document(_ data: Data, password: String = "", progress: (_ done: Int, _ total: Int) -> Void = { _, _ in }) throws(PDFToolError) -> Data {
        try Docx.data(pages: try pages(data, password: password, progress: progress))
    }

    static func pages(_ data: Data, password: String = "", progress: (_ done: Int, _ total: Int) -> Void = { _, _ in }) throws(PDFToolError) -> [Docx.Page] {
        let document = try PDFDocumentValidation.open(data, password: password)
        let sizes = try PageGeometry.displayedSizes(of: document)
        var pages: [Docx.Page] = []
        for (index, size) in sizes.enumerated() {
            guard !Task.isCancelled else { throw .cancelled }
            guard let page = document.page(at: index) else { throw .invalidDocument }
            progress(index + 1, sizes.count)
            // PDFKit autoreleases the text and the drawing of each page.
            let made: Result<Docx.Page, PDFToolError> = autoreleasepool {
                let scan = page.pageRef.map(PageScan.init) ?? PageScan()
                let lines = lines(of: page, scan: scan)
                var blocks = paragraphs(of: lines)
                do throws(PDFToolError) {
                    for picture in try pictures(of: page, size: size, frames: scan.pictures.map(\.frame), hasText: !lines.isEmpty) {
                        // Before the first paragraph that starts lower than the picture, in the same band of the page.
                        let before = blocks.firstIndex { $0.top >= picture.top && $0.left < picture.right && $0.right > picture.left }
                        blocks.insert(picture, at: before ?? blocks.count)
                    }
                } catch {
                    return .failure(error)
                }
                return .success(Docx.Page(size: size, blocks: blocks.map(\.block)))
            }
            pages.append(try made.get())
        }
        return pages
    }

    /// PDFKit gives the lines, in reading order, and the size of each letter; the content of the page gives the fonts.
    /// `characterBounds(at:)` and `characterIndex(at:)` are not used: they count the letters without the line breaks
    /// that `string` has, so their numbers drift by one at each line.
    private static func lines(of page: PDFPage, scan: PageScan) -> [Line] {
        guard let text = page.attributedString, text.length > 0 else { return [] }
        let string = text.string as NSString
        let toReader = PageGeometry.displayTransform(of: page)
        let height = PageGeometry.displayedBounds(of: page).height
        var lines: [Line] = []
        for selection in page.selection(for: NSRange(location: 0, length: string.length))?.selectionsByLine() ?? [] {
            let box = selection.bounds(for: page)
            let ranges = (0..<selection.numberOfTextRanges(on: page)).map { NSIntersectionRange(selection.range(at: $0, on: page), NSRange(location: 0, length: string.length)) }
            guard let first = ranges.first, first.length > 0 else { continue }
            // Where the font changes along the line. A piece of text whose first letter PDFKit does not find changes nothing.
            let starts = scan.starts(onLine: box)
            var face = starts.first?.face ?? PageScan.Face(postScript: (text.attribute(.font, at: first.location, effectiveRange: nil) as? NSFont)?.fontName ?? "")
            var changes: [(index: Int, face: PageScan.Face)] = []
            var last = face
            // PDFKit selects a letter when its middle is inside the box: the box is as large as half a letter of the line.
            let side = max(4, box.height * 0.55)
            for start in starts.dropFirst() where start.face != last {
                let letter = page.selection(for: CGRect(x: start.origin.x, y: start.origin.y, width: side, height: side))
                guard let letter, letter.numberOfTextRanges(on: page) > 0 else { continue }
                changes.append((letter.range(at: 0, on: page).location, start.face))
                last = start.face
            }
            var runs: [Docx.Run] = []
            var largest = 0.0
            for range in ranges {
                var index = range.location
                while index < NSMaxRange(range) {
                    let letter = string.rangeOfComposedCharacterSequence(at: index)
                    let at = index
                    index = NSMaxRange(letter)
                    let character = string.substring(with: letter).replacingOccurrences(of: "\t", with: " ")
                    guard let scalar = character.unicodeScalars.first, scalar.value >= 32 else { continue }
                    // A space takes the style of the word before it.
                    if character == " " {
                        if let end = runs.indices.last { runs[end].text += character }
                        continue
                    }
                    while let change = changes.first, change.index <= at {
                        face = change.face
                        changes.removeFirst()
                    }
                    let size = Double((((text.attribute(.font, at: at, effectiveRange: nil) as? NSFont)?.pointSize ?? box.height) * 2).rounded() / 2)
                    largest = max(largest, size)
                    append(Docx.Run(text: character, font: face.family, size: size, bold: face.bold, italic: face.italic), to: &runs)
                }
            }
            if let end = runs.indices.last {
                runs[end].text = String(runs[end].text.reversed().drop(while: \.isWhitespace).reversed())
                if runs[end].text.isEmpty { runs.removeLast() }
            }
            guard !runs.isEmpty else { continue }
            let shown = box.applying(toReader)
            let line = Line(runs: runs, left: shown.minX, right: shown.maxX, baseline: height - shown.minY, size: largest)
            // PDFKit cuts a line at a wide blank: the pieces that follow each other on one baseline are one line.
            if let before = lines.indices.last, abs(lines[before].baseline - line.baseline) < 0.3 * line.size, line.left >= lines[before].right - 1 {
                if let end = lines[before].runs.indices.last { lines[before].runs[end].text += " " }
                for run in line.runs { append(run, to: &lines[before].runs) }
                lines[before].right = line.right
                lines[before].size = max(lines[before].size, line.size)
            } else {
                lines.append(line)
            }
        }
        return lines
    }

    private static func append(_ run: Docx.Run, to runs: inout [Docx.Run]) {
        if let last = runs.indices.last, runs[last].font == run.font, runs[last].size == run.size, runs[last].bold == run.bold, runs[last].italic == run.italic {
            runs[last].text += run.text
        } else {
            runs.append(run)
        }
    }

    /// A short line ends its paragraph only after a sentence: ragged text has short lines everywhere. Short means short of
    /// the lines that start where it starts, not of the page, or every line of a left column would be short.
    private static func paragraphs(of lines: [Line]) -> [Placed] {
        func edge(_ line: Line) -> CGFloat { lines.filter { abs($0.left - line.left) < 3 * line.size }.map(\.right).max() ?? line.right }
        func text(_ line: Line) -> String { line.runs.map(\.text).joined() }
        func has(_ pattern: String, _ text: String) -> Bool { text.range(of: pattern, options: .regularExpression) != nil }
        var placed: [Placed] = []
        var runs: [Docx.Run] = []
        var previous: Line?
        for line in lines {
            var starts = true
            if let previous {
                let gap = line.baseline - previous.baseline
                let ended = previous.right < edge(previous) - 4 * previous.size && has(sentenceEnd, text(previous))
                starts = gap <= 0 || gap > 1.6 * previous.size || abs(line.size - previous.size) > 0.5 || ended || has(bullet, text(line))
            }
            if starts {
                runs = []
                placed.append(Placed(top: line.baseline - line.size, left: line.left, right: line.right, block: .text([])))
            } else {
                if let last = runs.indices.last, !has("[\\s-]$", runs[last].text) { runs[last].text += " " }
                placed[placed.count - 1].left = min(placed[placed.count - 1].left, line.left)
                placed[placed.count - 1].right = max(placed[placed.count - 1].right, line.right)
            }
            for run in line.runs { append(run, to: &runs) }
            placed[placed.count - 1].block = .text(runs)
            previous = line
        }
        return placed
    }

    /// Each picture as the page draws it, cut out of one drawing of the page: its mask, its turn and its colours are the
    /// page's. What the page writes over a picture stays on it.
    private static func pictures(of page: PDFPage, size: CGSize, frames: [CGRect], hasText: Bool) throws(PDFToolError) -> [Placed] {
        let toReader = PageGeometry.displayTransform(of: page)
        var placed: [Placed] = []
        var drawing: CGImage?
        for frame in frames {
            let shown = frame.applying(toReader).standardized.intersection(CGRect(origin: .zero, size: size))
            guard shown.width >= smallest, shown.height >= smallest else { continue }
            // A scan read by OCR: its text is in the document already, its picture would repeat it.
            if hasText, shown.width * shown.height > 0.8 * size.width * size.height { continue }
            // The same picture drawn twice at the same place, as some scanners do, is one picture.
            if placed.contains(where: { abs($0.left - shown.minX) < 1 && abs($0.right - shown.maxX) < 1 && abs($0.top - (size.height - shown.maxY)) < 1 }) { continue }
            if drawing == nil {
                drawing = try render(page, size: size, maxDimension: Int((max(size.width, size.height) * resolution / 72).rounded()), limit: PDFRedaction.longestSide)
            }
            guard let drawing else { continue }
            let scale = CGFloat(drawing.width) / size.width
            let cut = CGRect(x: shown.minX * scale, y: (size.height - shown.maxY) * scale, width: shown.width * scale, height: shown.height * scale).integral
            guard let image = drawing.cropping(to: cut), let jpeg = jpegData(image, quality: 0.85) else { continue }
            placed.append(Placed(top: size.height - shown.maxY, left: shown.minX, right: shown.maxX, block: .picture(jpeg: jpeg, size: shown.size)))
        }
        return placed
    }
}
