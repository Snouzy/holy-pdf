import CoreGraphics
import Foundation
import PDFKit

public enum PDFMergeNotice: Hashable, Sendable {
    case accessibilityTags, archivalProfile
}

public struct MergeDocumentInfo: Identifiable, Equatable, Sendable {
    public let id: UUID
    public let pageCount: Int
    public let isEncrypted: Bool
    public let notices: Set<PDFMergeNotice>

    public init(id: UUID, pageCount: Int, isEncrypted: Bool, notices: Set<PDFMergeNotice> = []) {
        self.id = id
        self.pageCount = pageCount
        self.isEncrypted = isEncrypted
        self.notices = notices
    }
}

public actor PDFMergeCollection {
    public static let maxDocumentCount = 100
    public static let maxDocumentBytes = 256 * 1024 * 1024
    public static let maxTotalBytes = 512 * 1024 * 1024

    private struct Entry {
        let data: Data
        let password: String
        let info: MergeDocumentInfo
    }

    private var entries: [UUID: Entry] = [:]
    private var totalBytes = 0

    public init() {}

    public func add(data: Data, password: String = "") throws(PDFToolError) -> MergeDocumentInfo {
        guard !Task.isCancelled else { throw .cancelled }
        try Self.validateCapacity(existingCount: entries.count, existingBytes: totalBytes, newBytes: data.count)
        let document = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        let notices = try Self.checkStructures(data, password: password)
        _ = try Self.checkedPageSizes(document)
        let info = MergeDocumentInfo(id: UUID(), pageCount: document.pageCount, isEncrypted: document.isEncrypted, notices: notices)
        entries[info.id] = Entry(data: data, password: password, info: info)
        totalBytes += data.count
        return info
    }

    public func remove(id: UUID) {
        if let entry = entries.removeValue(forKey: id) { totalBytes -= entry.data.count }
    }

    public func preview(id: UUID, pageIndex: Int = 0, maxDimension: Int = 240) throws(PDFToolError) -> CGImage {
        guard !Task.isCancelled else { throw .cancelled }
        guard let entry = entries[id] else { throw .invalidOrder }
        guard maxDimension > 0 else { throw .renderFailed }
        let document = try PDFDocumentValidation.open(entry.data, password: entry.password)
        guard pageIndex >= 0, pageIndex < document.pageCount,
              let page = document.page(at: pageIndex) else { throw .invalidDocument }
        return try render(page, size: PageGeometry.displayedBounds(of: page).size, maxDimension: maxDimension)
    }

    public func mergedData(order: [UUID]) throws(PDFToolError) -> Data {
        guard order.count >= 2, Set(order).count == order.count, order.allSatisfy({ entries[$0] != nil }) else { throw .invalidOrder }
        guard !Task.isCancelled else { throw .cancelled }
        let output = PDFDocument()
        let outline = PDFOutline()
        for (position, id) in order.enumerated() {
            guard !Task.isCancelled else { throw .cancelled }
            guard let entry = entries[id] else { throw .invalidOrder }
            let source = try PDFDocumentValidation.open(entry.data, password: entry.password)
            let pages = try (0..<source.pageCount).map { index throws(PDFToolError) in
                guard let page = source.page(at: index) else { throw .invalidDocument }
                return page
            }
            // Resolve named destinations while their source catalog is still available.
            let widgets = pages.flatMap(\.annotations).filter { $0.type == "Widget" }.map { ($0, $0.fieldName) }
            for page in pages {
                for annotation in page.annotations {
                    if let action = annotation.action {
                        try Self.checkDestination(action, in: source)
                        annotation.action = action
                    }
                }
            }
            for (widget, name) in widgets {
                guard let name, !name.isEmpty else { throw .unsupportedDocument }
                widget.fieldName = "HolyPDF\(position + 1).\(name)"
            }
            if let root = source.outlineRoot {
                let children = (0..<root.numberOfChildren).compactMap { root.child(at: $0) }
                var count = 0
                for child in children {
                    try Self.prepareOutline(child, source: source, depth: 0, count: &count)
                    child.removeFromParent()
                    outline.insertChild(child, at: outline.numberOfChildren)
                }
            }
            for page in pages {
                guard !Task.isCancelled else { throw .cancelled }
                output.insert(page, at: output.pageCount)
            }
        }
        if outline.numberOfChildren > 0 { output.outlineRoot = outline }
        output.documentAttributes = [PDFDocumentAttribute.creatorAttribute: PDFWriter.creator]
        guard let data = output.dataRepresentation(), !data.isEmpty else { throw .writeFailed }
        return data
    }

    static func validateCapacity(existingCount: Int, existingBytes: Int, newBytes: Int) throws(PDFToolError) {
        guard existingCount < maxDocumentCount else { throw .tooManyDocuments }
        guard newBytes <= maxDocumentBytes else { throw .fileTooLarge }
        guard newBytes <= maxTotalBytes - existingBytes else { throw .collectionTooLarge }
    }

    static func checkedPageSizes(_ document: PDFDocument) throws(PDFToolError) -> [CGSize] {
        try (0..<document.pageCount).map { index throws(PDFToolError) in
            guard !Task.isCancelled else { throw .cancelled }
            guard let page = document.page(at: index) else { throw .invalidDocument }
            let size = PageGeometry.displayedBounds(of: page).size
            guard size.width.isFinite, size.height.isFinite, size.width > 0, size.height > 0 else { throw .invalidDocument }
            for annotation in page.annotations {
                if let action = annotation.action { try checkDestination(action, in: document) }
                else if annotation.value(forAnnotationKey: .destination) != nil || annotation.value(forAnnotationKey: .action) != nil {
                    throw .unsupportedDocument
                }
                if annotation.type == "Widget", annotation.fieldName?.isEmpty != false { throw .unsupportedDocument }
            }
            return size
        }
    }

    static func checkDestination(_ action: PDFAction, in document: PDFDocument) throws(PDFToolError) {
        if let goTo = action as? PDFActionGoTo {
            guard let page = goTo.destination.page, document.index(for: page) != NSNotFound else { throw .unsupportedDocument }
        }
    }

    private static func prepareOutline(_ node: PDFOutline, source: PDFDocument, depth: Int, count: inout Int) throws(PDFToolError) {
        guard depth < 64, count < 100_000 else { throw .unsupportedDocument }
        count += 1
        if let action = node.action {
            try checkDestination(action, in: source)
            node.action = action
        }
        for index in 0..<node.numberOfChildren {
            guard let child = node.child(at: index) else { throw .unsupportedDocument }
            try prepareOutline(child, source: source, depth: depth + 1, count: &count)
        }
    }

    static func checkStructures(_ data: Data, password: String) throws(PDFToolError) -> Set<PDFMergeNotice> {
        guard let provider = CGDataProvider(data: data as CFData), let pdf = CGPDFDocument(provider),
              pdf.isUnlocked || pdf.unlockWithPassword(password), let catalog = pdf.catalog else { throw .invalidDocument }
        var notices = Set<PDFMergeNotice>()
        if catalog.has("StructTreeRoot") || catalog.has("MarkInfo") { notices.insert(.accessibilityTags) }
        if catalog.has("OutputIntents") || pdf.info?.has("GTS_PDFXVersion") == true { notices.insert(.archivalProfile) }
        for key in ["AF", "Collection", "OCProperties", "AA"] where catalog.has(key) { throw .unsupportedDocument }
        if catalog.has("OpenAction") {
            if let action = catalog.dictionary("OpenAction") {
                guard action.name("S") == "GoTo", !action.has("Next") else { throw .unsupportedDocument }
            } else if catalog.array("OpenAction") == nil { throw .unsupportedDocument }
        }
        if let names = catalog.dictionary("Names") {
            var unsupported = false
            CGPDFDictionaryApplyFunction(names, { key, _, info in
                if String(cString: key) != "Dests" { info?.assumingMemoryBound(to: Bool.self).pointee = true }
            }, &unsupported)
            if unsupported { throw .unsupportedDocument }
        }
        var visited = 0
        func inspect(_ owner: CGPDFDictionaryRef, depth: Int = 0) throws(PDFToolError) {
            guard depth < 64, visited < 100_000 else { throw .unsupportedDocument }
            visited += 1
            for key in ["AA", "AF", "OC"] where owner.has(key) { throw .unsupportedDocument }
            if ["FileAttachment", "RichMedia", "3D", "Screen", "Movie", "Sound"].contains(owner.name("Subtype") ?? "") { throw .unsupportedDocument }
            if let action = owner.dictionary("A") {
                guard ["URI", "GoTo"].contains(action.name("S") ?? ""), !action.has("Next") else { throw .unsupportedDocument }
            }
            for child in owner.dictionaries("Kids") { try inspect(child, depth: depth + 1) }
        }
        if let form = catalog.dictionary("AcroForm") {
            guard !form.has("XFA"), !form.has("CO") else { throw .unsupportedDocument }
            for field in form.dictionaries("Fields") { try inspect(field) }
        }
        func inspectOutlines(_ first: CGPDFDictionaryRef, depth: Int) throws(PDFToolError) {
            guard depth < 64 else { throw .unsupportedDocument }
            var current: CGPDFDictionaryRef? = first
            while let node = current {
                try inspect(node)
                if let child = node.dictionary("First") { try inspectOutlines(child, depth: depth + 1) }
                current = node.dictionary("Next")
            }
        }
        if let outlines = catalog.dictionary("Outlines"), let first = outlines.dictionary("First") { try inspectOutlines(first, depth: 0) }
        for index in 1...pdf.numberOfPages {
            guard !Task.isCancelled else { throw .cancelled }
            guard let page = pdf.page(at: index), let owner = page.dictionary else { throw .invalidDocument }
            try inspect(owner)
            for annotation in owner.dictionaries("Annots") { try inspect(annotation) }
        }
        return notices
    }
}
