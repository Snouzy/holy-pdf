import PDFCore
import ScanCore

extension PDFPageInput {
    public init(_ page: ProcessedPage, searchableText: Bool = true) {
        self.init(jpeg: page.jpeg,
                  pageSize: PageSizing.pdfPageSize(format: page.format, pixels: page.pixelSize),
                  textLines: searchableText ? page.lines.map { PDFTextLine(text: $0.text, box: $0.box.cgRect) } : [])
    }
}
