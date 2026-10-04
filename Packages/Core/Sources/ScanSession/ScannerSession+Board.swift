import Foundation
import ScanCore

/// Where a page sits on the board: its document as it was then, the document's index, and the page's index in it.
struct Slot {
    var document: ScanDocument
    var documentIndex: Int
    var pageIndex: Int
}

/// What a deletion took away, so that its undo can put it back.
struct RemovedPage {
    var page: ScanPage
    var slot: Slot?
    var pendingIndex: Int?
    var unreadableIndex: Int?
    /// The whole import the page belonged to, while that import was running.
    var batch: [UUID]?
}

extension ScannerSession {
    public var pageOrder: [UUID] { documents.flatMap(\.pageIDs) }

    public var pagesToReview: [UUID] { (pageOrder + pending).filter { pages[$0]?.needsReview == true } }

    /// Lowercased names that more than one document uses. Export is blocked while there is one.
    public var duplicateNames: Set<String> { NameFormatting.duplicates(documents.map(\.name)) }

    public var hasUnexportedDocuments: Bool { !pending.isEmpty || documents.contains { !$0.exported } }

    public func document(containing pageID: UUID) -> ScanDocument? {
        documents.first { $0.pageIDs.contains(pageID) }
    }

    /// An empty or unsafe-only name leaves the old one. The name field calls it at each keystroke, then `finishRenaming` once.
    public func rename(_ documentID: UUID, to text: String) {
        let name = NameFormatting.fileSafe(text)
        guard !name.isEmpty, let index = documents.firstIndex(where: { $0.id == documentID }),
              documents[index].name != name else { return }
        documents[index].name = name
        documents[index].exported = false
    }

    /// Registers one undo for a whole editing of the name, back to `previous`.
    public func finishRenaming(_ documentID: UUID, from previous: String, undoManager: UndoManager?) {
        guard let name = documents.first(where: { $0.id == documentID })?.name, name != previous else { return }
        registerBoardUndo(.rename, undoManager) { [weak undoManager] session in
            // Not through `rename`: `fileSafe` would cut a second ".pdf" off a name that ends with one.
            guard let index = session.documents.firstIndex(where: { $0.id == documentID }) else { return }
            session.documents[index].name = previous
            session.documents[index].exported = false
            session.finishRenaming(documentID, from: name, undoManager: undoManager)
        }
    }

    /// Puts the page at `index` of the document, counted before the move. A document left empty disappears.
    public func move(_ pageID: UUID, to documentID: UUID, at index: Int, undoManager: UndoManager?) {
        guard let source = document(containing: pageID), let from = source.pageIDs.firstIndex(of: pageID),
              let destinationIndex = documents.firstIndex(where: { $0.id == documentID }) else { return }
        let destination = documents[destinationIndex]
        let sameDocument = source.id == destination.id
        let target = min(max(sameDocument && from < index ? index - 1 : index, 0), destination.pageIDs.count - (sameDocument ? 1 : 0))
        guard !sameDocument || target != from, let old = detach(pageID) else { return }
        place(pageID, at: Slot(document: destination, documentIndex: destinationIndex, pageIndex: target), leaving: old,
              .movePage, undoManager: undoManager)
    }

    /// Takes a page out into a new document placed after `documentID`, named from the page's own text.
    public func moveToNewDocument(_ pageID: UUID, after documentID: UUID, undoManager: UndoManager?) {
        guard let source = document(containing: pageID), source.id != documentID || source.pageIDs.count > 1,
              let processed = pages[pageID]?.status.result?.processed else { return }
        let text = PageText(id: pageID, lines: processed.lines, captureDate: processed.captureDate)
        guard let suggestion = DocumentSuggester.suggest([text], today: today()).first, let old = detach(pageID) else { return }
        let name = NameFormatting.uniqued([suggestion.name], avoiding: Set(documents.map(\.name))).first ?? suggestion.name
        let position = documents.firstIndex { $0.id == documentID }.map { $0 + 1 } ?? documents.count
        let created = ScanDocument(name: name, pageIDs: [], evidence: suggestion.evidence)
        place(pageID, at: Slot(document: created, documentIndex: position, pageIndex: 0), leaving: old, .newDocument, undoManager: undoManager)
    }

    /// Deletes every page of the document; the emptied document goes with its last page.
    public func deleteDocument(_ documentID: UUID, undoManager: UndoManager?) {
        guard let document = documents.first(where: { $0.id == documentID }) else { return }
        delete(document.pageIDs, .deleteDocument, undoManager: undoManager)
    }

    /// A queued page is never rendered, and a render in flight is dropped when it lands.
    public func delete(_ pageID: UUID, undoManager: UndoManager?) {
        delete([pageID], .deletePage, undoManager: undoManager)
    }

    public func markChecked(_ pageID: UUID) {
        pages[pageID]?.checked = true
    }

    /// The next page that can be corrected, in board order, then the running imports.
    public func page(after pageID: UUID, reviewOnly: Bool = false) -> UUID? {
        let order = (pageOrder + pending).filter { pages[$0]?.status.result != nil }
        guard let index = order.firstIndex(of: pageID) else { return nil }
        return order[(index + 1)...].first { !reviewOnly || pages[$0]?.needsReview == true }
    }

    func place(_ pageID: UUID, at slot: Slot, leaving old: Slot, _ action: EditAction, undoManager: UndoManager?) {
        attach(pageID, at: slot)
        registerBoardUndo(action, undoManager) { [weak undoManager] session in
            guard let here = session.detach(pageID) else { return }
            session.place(pageID, at: old, leaving: here, action, undoManager: undoManager)
        }
    }

    func detach(_ pageID: UUID) -> Slot? {
        guard let documentIndex = documents.firstIndex(where: { $0.pageIDs.contains(pageID) }),
              let pageIndex = documents[documentIndex].pageIDs.firstIndex(of: pageID) else { return nil }
        let slot = Slot(document: documents[documentIndex], documentIndex: documentIndex, pageIndex: pageIndex)
        documents[documentIndex].pageIDs.remove(at: pageIndex)
        documents[documentIndex].exported = false
        if documents[documentIndex].pageIDs.isEmpty { documents.remove(at: documentIndex) }
        return slot
    }

    /// A document that went away comes back with its id, name and evidence.
    func attach(_ pageID: UUID, at slot: Slot) {
        if let index = documents.firstIndex(where: { $0.id == slot.document.id }) {
            documents[index].pageIDs.insert(pageID, at: min(slot.pageIndex, documents[index].pageIDs.count))
            documents[index].exported = false
        } else {
            var document = slot.document
            document.pageIDs = [pageID]
            document.exported = false
            documents.insert(document, at: min(slot.documentIndex, documents.count))
        }
    }

    func delete(_ pageIDs: [UUID], _ action: EditAction, undoManager: UndoManager?) {
        let removed = pageIDs.compactMap(remove)
        guard !removed.isEmpty else { return }
        settleBatches()
        resumeIdleWaiters()
        registerBoardUndo(action, undoManager) { [weak undoManager] session in
            session.restore(removed, action, undoManager: undoManager)
        }
    }

    func remove(_ pageID: UUID) -> RemovedPage? {
        guard let page = pages.removeValue(forKey: pageID) else { return nil }
        let removed = RemovedPage(page: page, slot: detach(pageID), pendingIndex: pending.firstIndex(of: pageID),
                                  unreadableIndex: unreadable.firstIndex(of: pageID), batch: batches.first { $0.contains(pageID) })
        queue.removeAll { $0 == pageID }
        pending.removeAll { $0 == pageID }
        unreadable.removeAll { $0 == pageID }
        batches = batches.map { $0.filter { $0 != pageID } }.filter { !$0.isEmpty }
        return removed
    }

    /// In reverse order: a deleted document comes back with its last page, and each earlier page goes in front of it.
    func restore(_ removed: [RemovedPage], _ action: EditAction, undoManager: UndoManager?) {
        for item in removed.reversed() {
            let id = item.page.id
            pages[id] = item.page
            if let slot = item.slot { attach(id, at: slot) }
            if let index = item.pendingIndex { pending.insert(id, at: min(index, pending.count)) }
            if let index = item.unreadableIndex { unreadable.insert(id, at: min(index, unreadable.count)) }
            if let batch = item.batch { rejoin(id, batch) }
            // A render still in flight lands on the restored page; one that landed while the page was deleted was dropped.
            if !item.page.status.isSettled, !rendering.contains(id) {
                if item.page.status.result == nil { queue.append(id) } else { startRender(id) }
            }
        }
        pump()
        settleBatches()
        registerBoardUndo(action, undoManager) { [weak undoManager] session in
            session.delete(removed.map(\.page.id), action, undoManager: undoManager)
        }
    }

    /// Back in its import if that import still runs, else in an import of its own.
    func rejoin(_ pageID: UUID, _ batch: [UUID]) {
        let others = Set(batch).subtracting([pageID])
        guard let index = batches.firstIndex(where: { !others.isDisjoint(with: $0) }) else {
            batches.append([pageID])
            return
        }
        batches[index].insert(pageID, at: min(batch.firstIndex(of: pageID) ?? 0, batches[index].count))
    }

    /// Each board change registers its inverse, not a copy of the board: imports that settle in between must stay.
    func registerBoardUndo(_ action: EditAction, _ undoManager: UndoManager?, _ inverse: @escaping @MainActor (ScannerSession) -> Void) {
        guard let undoManager else { return }
        if undoManager.isUndoing || undoManager.isRedoing { showBoard() }
        undoManager.registerUndo(withTarget: self, handler: inverse)
        undoManager.setActionName(describeAction(action))
    }
}
