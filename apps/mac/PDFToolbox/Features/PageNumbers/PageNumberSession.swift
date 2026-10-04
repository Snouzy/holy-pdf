import CoreGraphics
import Foundation
import Observation
import PDFCore

@MainActor
@Observable
final class PageNumberSession {
    /// Kept from one PDF to the next: the same numbering often goes on several documents.
    struct Settings: Equatable {
        var format = PageNumbering.Format.number
        var position = PageNumbering.Position.bottomCenter
        var first = 1
        var fontSize: CGFloat = 11
        var allPages = true
        var firstPage = 0
        var lastPage = 0
    }

    let file = PDFCopySession(describe: PageNumberText.message)
    private(set) var settings = Settings()

    init() {
        file.overlay = { [weak self] index in
            guard let numbering = self?.numbering else { return nil }
            return { context, page in numbering.draw(page: index, in: context, displayed: page) }
        }
    }

    /// Nil without a document. The range is narrowed to the pages of the document on screen.
    var numbering: PageNumbering? {
        let last = file.pageSizes.count - 1
        guard last >= 0 else { return nil }
        let from = settings.allPages ? 0 : min(settings.firstPage, last)
        var numbering = PageNumbering(pages: from...(settings.allPages ? last : min(max(settings.lastPage, from), last)))
        numbering.format = settings.format
        numbering.position = settings.position
        numbering.first = settings.first
        numbering.fontSize = settings.fontSize
        return numbering
    }

    func update(_ change: (inout Settings) -> Void) {
        guard file.state == .ready else { return }
        var next = settings
        change(&next)
        let last = file.pageSizes.count - 1
        next.first = min(max(next.first, 0), 99_999)
        next.fontSize = min(max(next.fontSize, PageNumbering.fontSizes.lowerBound), PageNumbering.fontSizes.upperBound)
        next.firstPage = min(max(next.firstPage, 0), last)
        next.lastPage = min(max(next.lastPage, next.firstPage), last)
        guard next != settings else { return }
        settings = next
        file.edited()
        file.refreshPreview()
    }

    private var maker: PDFCopySession.Maker? {
        guard let numbering else { return nil }
        return { data, password in try PDFPageNumbers.numbered(data, password: password, numbering) }
    }

    func export() {
        if let maker { file.export(suffix: String(localized: "numbered"), make: maker) }
    }

    func saveCopy(to url: URL) async {
        if let maker { await file.saveCopy(to: url, make: maker) }
    }
}

enum PageNumberText {
    static func message(_ error: Error) -> String {
        switch error as? PDFToolError {
        case .alreadySigned: String(localized: "This PDF has a digital signature. Page numbers would invalidate it.")
        case .invalidPlacement: String(localized: "Check the page number settings before saving.")
        default: SigningText.message(error)
        }
    }
}
