import Foundation
import ScanCore

public enum EditAction: Sendable {
    case moveCorners, autoDetection, rotate, rendering, watermark, format, erase
    case deletePage, deleteDocument, movePage, newDocument, rename
}

extension ScannerSession {
    /// `nil` goes back to the automatic detection. A quad that `Geometry.isUsable` rejects changes nothing.
    @discardableResult
    public func setQuad(_ quad: Quad?, for pageID: UUID, undoManager: UndoManager?) -> Bool {
        if let quad, !Geometry.isUsable(quad) { return false }
        edit(pageID, quad == nil ? .autoDetection : .moveCorners, undoManager: undoManager) { edits, _ in edits.quad = quad }
        return true
    }

    /// A quarter turn clockwise. Erased areas turn with the page.
    public func rotate(_ pageID: UUID, undoManager: UndoManager?) {
        edit(pageID, .rotate, undoManager: undoManager) { edits, rendered in
            let turns = edits.quarterTurns ?? rendered.quarterTurns
            // The render may still show an older turn: the marks need the size of the page as it is now.
            let size = (turns - rendered.quarterTurns) % 2 == 0
                ? rendered.pixelSize : PixelSize(width: rendered.pixelSize.height, height: rendered.pixelSize.width)
            edits.quarterTurns = (turns + 1) % 4
            edits.erase = edits.erase.map { $0.rotated(quarterTurns: 1, pageSize: size) }
        }
    }

    public func setMode(_ mode: RenderMode, for pageID: UUID, undoManager: UndoManager?) {
        edit(pageID, .rendering, undoManager: undoManager) { edits, _ in edits.mode = mode }
    }

    public func setKeepWatermark(_ keep: Bool, for pageID: UUID, undoManager: UndoManager?) {
        edit(pageID, .watermark, undoManager: undoManager) { edits, _ in edits.keepWatermark = keep }
    }

    public func setFormat(_ format: PageFormat, for pageID: UUID, undoManager: UndoManager?) {
        edit(pageID, .format, undoManager: undoManager) { edits, _ in edits.format = format }
    }

    public func addErase(_ mark: EraseMark, to pageID: UUID, undoManager: UndoManager?) {
        edit(pageID, .erase, undoManager: undoManager) { edits, _ in edits.erase.append(mark) }
    }

    func edit(_ pageID: UUID, _ action: EditAction, undoManager: UndoManager?,
              _ change: (inout PageEdits, ProcessedPage) -> Void) {
        guard let page = pages[pageID], let rendered = page.status.result?.processed else { return }
        let current = Self.resolvedEdits(page.edits, previous: rendered)
        var edits = current
        change(&edits, rendered)
        guard edits != current else { return }
        apply(edits, to: pageID, action, undoManager: undoManager)
    }

    func apply(_ edits: PageEdits, to pageID: UUID, _ action: EditAction, undoManager: UndoManager?) {
        guard let page = pages[pageID] else { return }
        // Saved as the page shows it: a nil field would follow the render this edit produces, and undo would restore nothing.
        let before = Self.resolvedEdits(page.edits, previous: page.status.result?.processed)
        pages[pageID]?.edits = edits
        if let undoManager, undoManager.isUndoing || undoManager.isRedoing { showPage(pageID) }
        undoManager?.registerUndo(withTarget: self) { [weak undoManager] session in
            session.apply(before, to: pageID, action, undoManager: undoManager)
        }
        undoManager?.setActionName(describeAction(action))
        for index in documents.indices where documents[index].pageIDs.contains(pageID) {
            documents[index].exported = false
        }
        startRender(pageID)
    }
}
