import CoreGraphics
import Foundation
import PDFKit

public struct OrganizedPage: Identifiable, Equatable, Sendable {
    public let id: Int
    public var rotation: Int

    public init(id: Int, rotation: Int = 0) {
        self.id = id
        self.rotation = rotation
    }
}

public struct OrganizingDocumentInfo: Sendable {
    public let pageSizes: [CGSize]
    public let isEncrypted: Bool
    public let notices: Set<PDFMergeNotice>
}

public actor PDFOrganizingDocument {
    public static let maxDocumentBytes = PDFMergeCollection.maxDocumentBytes

    private let data: Data
    private let password: String
    private let document: PDFDocument
    private let info: OrganizingDocumentInfo

    public init(data: Data, password: String = "") throws(PDFToolError) {
        guard !Task.isCancelled else { throw .cancelled }
        guard data.count <= Self.maxDocumentBytes else { throw .fileTooLarge }
        let document = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        let notices = try PDFMergeCollection.checkStructures(data, password: password)
        let sizes = try PDFMergeCollection.checkedPageSizes(document)
        self.data = data
        self.password = password
        self.document = document
        info = OrganizingDocumentInfo(pageSizes: sizes, isEncrypted: document.isEncrypted, notices: notices)
    }

    public func information() -> OrganizingDocumentInfo { info }

    public func preview(pageIndex: Int, maxDimension: Int = 240) throws(PDFToolError) -> CGImage {
        guard !Task.isCancelled else { throw .cancelled }
        guard maxDimension > 0 else { throw .renderFailed }
        guard info.pageSizes.indices.contains(pageIndex), let page = document.page(at: pageIndex) else { throw .invalidDocument }
        let image = try render(page, size: info.pageSizes[pageIndex], maxDimension: maxDimension)
        guard !Task.isCancelled else { throw .cancelled }
        return image
    }

    public func organizedData(pages: [OrganizedPage]) throws(PDFToolError) -> Data {
        guard !Task.isCancelled else { throw .cancelled }
        let retained = Set(pages.map(\.id))
        guard !pages.isEmpty, retained.count == pages.count,
              pages.allSatisfy({ info.pageSizes.indices.contains($0.id) && [0, 90, 180, 270].contains($0.rotation) }) else {
            throw .invalidOrder
        }
        let source = try PDFDocumentValidation.open(data, password: password)
        let output = PDFDocument()
        let selected = try pages.map { entry throws(PDFToolError) -> PDFPage in
            guard !Task.isCancelled else { throw .cancelled }
            guard let page = source.page(at: entry.id) else { throw .invalidDocument }
            // Resolve named destinations before moving any page out of its source catalog.
            for annotation in page.annotations {
                guard let action = annotation.action else { continue }
                try PDFMergeCollection.checkDestination(action, in: source)
                if let target = (action as? PDFActionGoTo)?.destination.page,
                   !retained.contains(source.index(for: target)) {
                    page.removeAnnotation(annotation)
                } else { annotation.action = action }
            }
            page.rotation = ((page.rotation + entry.rotation) % 360 + 360) % 360
            return page
        }
        let outline = PDFOutline()
        if let root = source.outlineRoot {
            var count = 0
            for index in 0..<root.numberOfChildren {
                guard let child = root.child(at: index) else { throw .unsupportedDocument }
                if let copy = try Self.copyOutline(child, source: source, retained: retained, depth: 0, count: &count) {
                    outline.insertChild(copy, at: outline.numberOfChildren)
                }
            }
        }
        for page in selected {
            guard !Task.isCancelled else { throw .cancelled }
            output.insert(page, at: output.pageCount)
        }
        if outline.numberOfChildren > 0 { output.outlineRoot = outline }
        var attributes = source.documentAttributes ?? [:]
        attributes[PDFDocumentAttribute.creatorAttribute] = PDFWriter.creator
        output.documentAttributes = attributes
        guard !Task.isCancelled else { throw .cancelled }
        guard let result = output.dataRepresentation(), !result.isEmpty else { throw .writeFailed }
        guard !Task.isCancelled else { throw .cancelled }
        return result
    }

    private static func copyOutline(_ node: PDFOutline, source: PDFDocument, retained: Set<Int>, depth: Int,
                                    count: inout Int) throws(PDFToolError) -> PDFOutline? {
        guard !Task.isCancelled else { throw .cancelled }
        guard depth < 64, count < 100_000 else { throw .unsupportedDocument }
        count += 1
        let copy = PDFOutline()
        copy.label = node.label
        copy.isOpen = node.isOpen
        var removedDestination = false
        if let action = node.action {
            try PDFMergeCollection.checkDestination(action, in: source)
            if let target = (action as? PDFActionGoTo)?.destination.page, !retained.contains(source.index(for: target)) {
                removedDestination = true
            } else { copy.action = action }
        }
        for index in 0..<node.numberOfChildren {
            guard let child = node.child(at: index) else { throw .unsupportedDocument }
            if let descendant = try copyOutline(child, source: source, retained: retained, depth: depth + 1, count: &count) {
                copy.insertChild(descendant, at: copy.numberOfChildren)
            }
        }
        return removedDestination && copy.numberOfChildren == 0 ? nil : copy
    }
}
