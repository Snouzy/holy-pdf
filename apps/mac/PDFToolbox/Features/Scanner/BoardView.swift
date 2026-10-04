import AppKit
import ScanSession
import SwiftUI

enum Deletion {
    case page(UUID)
    case document(UUID)
}

struct BoardView: View {
    @Environment(ScannerSession.self) private var session
    @Environment(\.undoManager) private var undoManager
    @AppStorage(TipsBanner.dismissedKey) private var tipsDismissed = false
    @Binding var reviewOnly: Bool
    @Binding var toast: Toast?
    var open: (UUID) -> Void
    var addPhotos: () -> Void
    var export: () -> Void
    @State private var deletingDocument: UUID?
    @State private var toolbarClicks: Any?

    var body: some View {
        ScrollView {
            BoardRows(reviewOnly: reviewOnly, open: open, delete: delete,
                      download: { SaveDocument.run($0, session: session, toast: $toast) })
        }
        .dropDestination(for: URL.self) { urls, _ in
            session.add(urls)
            return !urls.isEmpty
        }
        .toast($toast)
        .safeAreaInset(edge: .bottom) {
            if tipsDismissed {
                Text("Click a page to correct it. Drag a page to move it to another document.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 9)
                    .background(.bar)
                    .contentShape(Rectangle())
                    .onTapGesture { Self.endEditing(in: NSApp.keyWindow) }
            }
        }
        .navigationSubtitle(subtitle)
        .toolbar {
            ToolbarItemGroup {
                let toCheck = session.pagesToReview.count
                if toCheck > 0 || reviewOnly {
                    Toggle(isOn: $reviewOnly) { Text("⚠︎ \(toCheck) pages to check") }
                        .toggleStyle(.button)
                        .help("Pages whose corners or text should be checked. Open them to correct or confirm.")
                        .buttonHover()
                }
                Button("Add Photos…", action: addPhotos)
                    .buttonHover()
                Button("Export \(session.documents.count) PDF", action: export)
                    .buttonStyle(.borderedProminent)
                    .buttonHover()
                    .disabled(!session.canExport)
            }
        }
        .confirmationDialog(deletionTitle, isPresented: Binding(get: { deletingDocument != nil }, set: { if !$0 { deletingDocument = nil } }),
                            titleVisibility: .visible, presenting: deletingDocument) { id in
            Button("Delete", role: .destructive) {
                session.deleteDocument(id, undoManager: undoManager)
                if session.pagesToReview.isEmpty { reviewOnly = false }
            }
        } message: { _ in
            Text("You can undo this with ⌘Z.")
        }
        // Not an onChange: opening the last flagged page empties the list, and « Next Page » must stay in the review.
        .onAppear { if session.pagesToReview.isEmpty { reviewOnly = false } }
        // SwiftUI has no tap gesture on the toolbar: a click there ends the name editing through AppKit.
        .onAppear {
            guard toolbarClicks == nil else { return }
            toolbarClicks = NSEvent.addLocalMonitorForEvents(matching: .leftMouseDown) { event in
                if let window = event.window, !window.contentLayoutRect.contains(event.locationInWindow) { Self.endEditing(in: window) }
                return event
            }
        }
        .onDisappear {
            toolbarClicks.map(NSEvent.removeMonitor)
            toolbarClicks = nil
        }
    }

    var subtitle: String {
        let pages = session.pageOrder.count + session.pending.count
        return [String(localized: "\(pages) pages"), String(localized: "\(session.documents.count) documents")].joined(separator: " · ")
    }

    var deletionTitle: String {
        session.documents.first { $0.id == deletingDocument }.map { String(localized: "Delete “\($0.name)” and its \($0.pageIDs.count) pages?") } ?? ""
    }

    /// A page deletion needs no confirmation: ⌘Z brings the page back.
    func delete(_ deletion: Deletion) {
        switch deletion {
        case .page(let id):
            session.delete(id, undoManager: undoManager)
            if session.pagesToReview.isEmpty { reviewOnly = false }
        case .document(let id):
            deletingDocument = id
        }
    }

    static func endEditing(in window: NSWindow?) {
        if window?.firstResponder is NSText { window?.makeFirstResponder(nil) }
    }
}

struct BoardRows: View {
    @Environment(ScannerSession.self) private var session
    @AppStorage(TipsBanner.dismissedKey) private var tipsDismissed = false
    @FocusState private var editingName: UUID?
    let reviewOnly: Bool
    var open: (UUID) -> Void
    var delete: (Deletion) -> Void
    var download: (UUID) -> Void

    var body: some View {
        ZStack(alignment: .top) {
            // Fills the visible board, so a click under the last row also ends the editing.
            Color.clear.containerRelativeFrame(.vertical)
            VStack(alignment: .leading, spacing: 14) {
                if !tipsDismissed {
                    TipsBanner { withAnimation(.easeOut(duration: 0.2)) { tipsDismissed = true } }
                }
                if !session.pending.isEmpty {
                    PendingRow(pageIDs: visible(session.pending), open: open, delete: { delete(.page($0)) })
                }
                ForEach(session.documents) { document in
                    let pageIDs = visible(document.pageIDs)
                    if !reviewOnly || !pageIDs.isEmpty {
                        DocumentRow(document: document, pageIDs: pageIDs, editingName: $editingName,
                                    open: open, delete: delete, download: download)
                    }
                }
                if !session.unreadable.isEmpty, !reviewOnly {
                    UnreadableRow(pageIDs: session.unreadable, delete: { delete(.page($0)) })
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 18)
        }
        .contentShape(Rectangle())
        .onTapGesture { editingName = nil }
    }

    func visible(_ pageIDs: [UUID]) -> [UUID] {
        reviewOnly ? pageIDs.filter { session.pages[$0]?.needsReview == true } : pageIDs
    }
}

struct TipsBanner: View {
    static let dismissedKey = "board.tipsDismissed"
    var hide: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            MonkAvatar(mood: .happy, size: 36)
            Text("Click a page to correct it. Drag it to move it to another document. ⚠︎ marks a page to check. Use ⋯ to download or delete a document.")
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button("Hide the tips", systemImage: "xmark", action: hide)
                .labelStyle(.iconOnly)
                .buttonStyle(.accessoryBar)
                .foregroundStyle(.secondary)
                .help("Hide the tips")
                .buttonHover()
        }
        .font(.callout)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.accentColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.accentColor.opacity(0.25)))
    }
}

/// Thumbnails wrap onto new lines, so a long document never needs a scroll bar of its own.
struct ThumbnailGrid<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 92, maximum: 92), spacing: 14, alignment: .top)],
                  alignment: .leading, spacing: 14) {
            content
        }
        .padding(.top, 8)
        .padding(.trailing, 8)
    }
}

struct DocumentRow: View {
    @Environment(ScannerSession.self) private var session
    @Environment(\.undoManager) private var undoManager
    let document: ScanDocument
    let pageIDs: [UUID]
    var editingName: FocusState<UUID?>.Binding
    var open: (UUID) -> Void
    var delete: (Deletion) -> Void
    var download: (UUID) -> Void
    @State private var name = ""
    @State private var nameBeforeEditing = ""
    @State private var hovering = false
    @State private var slotTargeted = false
    @State private var rowTargeted = false

    var editing: Bool { editingName.wrappedValue == document.id }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            ThumbnailGrid {
                ForEach(pageIDs, id: \.self) { id in
                    if let page = session.pages[id] {
                        let label = String(localized: "p. \(number(of: id))")
                        PageThumbnail(page: page, label: label, correct: { open(id) }, delete: { delete(.page(id)) })
                            .draggable(id.uuidString) { PageThumbnail(page: page, label: label) }
                            .dropDestination(for: String.self) { items, _ in
                                move(items, at: document.pageIDs.firstIndex(of: id) ?? 0)
                            }
                            .contextMenu {
                                Button("Correct…") { open(id) }
                                Button("Delete Page", role: .destructive) { delete(.page(id)) }
                            }
                    }
                }
                // The only page of a document is already alone: a slot there would take the drop and do nothing.
                if document.pageIDs.count > 1 {
                    NewDocumentSlot(targeted: slotTargeted)
                        .dropDestination(for: String.self) { items, _ in
                            guard let page = pageID(items) else { return false }
                            session.moveToNewDocument(page, after: document.id, undoManager: undoManager)
                            return true
                        } isTargeted: { slotTargeted = $0 }
                }
            }
        }
        .boardRow(hovered: hovering)
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.accentColor, lineWidth: 2).opacity(rowTargeted ? 1 : 0))
        .dropDestination(for: String.self) { items, _ in move(items, at: document.pageIDs.count) } isTargeted: { rowTargeted = $0 }
        .onHover { hovering = $0 }
        .onDisappear { hovering = false }
        .onAppear { name = document.name }
        .onChange(of: document.name) { _, new in if !editing { name = new } }
    }

    var header: some View {
        HStack(spacing: 12) {
            HStack(spacing: 4) {
                Button("Rename", systemImage: "pencil") { editingName.wrappedValue = document.id }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.accessoryBar)
                    .foregroundStyle(.secondary)
                    .help("Rename")
                    .opacity(editing ? 0 : 1)
                    .buttonHover()
                TextField("Document name", text: $name)
                    .textFieldStyle(.roundedBorder)
                    .font(.body.weight(.semibold))
                    .frame(width: 380)
                    .focused(editingName, equals: document.id)
                    .onChange(of: name) { _, typed in session.rename(document.id, to: typed) }
                    .onSubmit { editingName.wrappedValue = nil }
                    .onExitCommand {
                        session.rename(document.id, to: nameBeforeEditing)
                        editingName.wrappedValue = nil
                    }
                    .onChange(of: editing) { _, editing in
                        if editing { nameBeforeEditing = document.name } else { commitName() }
                    }
            }
            Text(ScannerText.reason(document.evidence))
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            if session.duplicateNames.contains(document.name.lowercased()) {
                Label("Same name as another document", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .fixedSize()
            }
            Spacer()
            Text("\(document.pageIDs.count) pages")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Download…", systemImage: "arrow.down.circle") { download(document.id) }
                .buttonStyle(.accessoryBar)
                .help("Download this document as a PDF…")
                .buttonHover()
            Menu {
                Button("Download PDF…") { download(document.id) }
                Button("Rename") { editingName.wrappedValue = document.id }
                Divider()
                Button("Delete Document…", role: .destructive) { delete(.document(document.id)) }
            } label: {
                Label("Document actions", systemImage: "ellipsis.circle")
            }
            .menuStyle(.button)
            .buttonStyle(.accessoryBar)
            .menuIndicator(.hidden)
            .labelStyle(.iconOnly)
            .fixedSize()
            .help("Document actions")
            .buttonHover()
        }
    }

    /// The page number in the document, also when the review filter hides other pages.
    func number(of pageID: UUID) -> Int {
        (document.pageIDs.firstIndex(of: pageID) ?? 0) + 1
    }

    func pageID(_ items: [String]) -> UUID? {
        items.first.flatMap(UUID.init(uuidString:)).flatMap { session.document(containing: $0) == nil ? nil : $0 }
    }

    func move(_ items: [String], at index: Int) -> Bool {
        guard let page = pageID(items) else { return false }
        session.move(page, to: document.id, at: index, undoManager: undoManager)
        return true
    }

    func commitName() {
        session.finishRenaming(document.id, from: nameBeforeEditing, undoManager: undoManager)
        name = session.documents.first { $0.id == document.id }?.name ?? name
    }
}

struct PendingRow: View {
    @Environment(ScannerSession.self) private var session
    let pageIDs: [UUID]
    var open: (UUID) -> Void
    var delete: (UUID) -> Void

    var body: some View {
        let progress = session.progress
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                ProgressView(value: Double(progress.done), total: Double(max(progress.total, 1)))
                    .frame(width: 160)
                Text("Reading photos: \(progress.done) of \(progress.total)…")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            ThumbnailGrid {
                ForEach(pageIDs, id: \.self) { id in
                    if let page = session.pages[id] {
                        PageThumbnail(page: page, label: page.url.lastPathComponent,
                                      correct: page.status.result == nil ? nil : { open(id) }, delete: { delete(id) })
                            .contextMenu {
                                if page.status.result != nil { Button("Correct…") { open(id) } }
                                Button("Delete Page", role: .destructive) { delete(id) }
                            }
                    }
                }
            }
        }
        .boardRow()
    }
}

struct UnreadableRow: View {
    @Environment(ScannerSession.self) private var session
    let pageIDs: [UUID]
    var delete: (UUID) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Unreadable photos").font(.headline)
            ForEach(pageIDs, id: \.self) { id in
                if let page = session.pages[id], case .failed(let error, _) = page.status {
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.octagon.fill").foregroundStyle(.red)
                        Text(page.url.lastPathComponent)
                        Text(ScannerText.message(for: error)).foregroundStyle(.secondary)
                        Spacer()
                        Button("Remove") { delete(id) }
                            .buttonHover()
                    }
                    .font(.callout)
                }
            }
        }
        .boardRow()
    }
}

struct PageThumbnail: View {
    let page: ScanPage
    let label: String
    var correct: (() -> Void)?
    var delete: (() -> Void)?
    @State private var hovering = false

    var body: some View {
        let lifted = hovering && correct != nil
        VStack(spacing: 6) {
            ZStack {
                sheet(lifted: lifted)
                switch page.status {
                case .queued, .processing:
                    ProgressView().controlSize(.small)
                case .failed:
                    Image(systemName: "exclamationmark.octagon.fill").foregroundStyle(.red)
                case .ready:
                    EmptyView()
                }
            }
            .scaleEffect(lifted ? 1.04 : 1)
            .frame(width: 92, height: 130)
            .overlay(alignment: .topTrailing) {
                if page.needsReview {
                    ReviewBadge(summary: ScannerText.reviewSummary(for: page)).offset(x: 7, y: -7)
                }
            }
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(width: 92)
        }
        .contentShape(Rectangle())
        .onTapGesture { correct?() }
        .onHover { hovering = $0 }
        .onDisappear { hovering = false }
        .pointerStyle(correct == nil ? nil : PointerStyle.link)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(correct == nil ? [] : .isButton)
        .accessibilityAction { correct?() }
        .accessibilityActions {
            if let correct { Button("Correct", action: correct) }
            if let delete { Button("Delete", action: delete) }
        }
        .animation(.easeOut(duration: 0.12), value: hovering)
        .help(help)
    }

    func sheet(lifted: Bool) -> some View {
        Group {
            if let thumbnail = page.status.result?.thumbnail {
                Image(decorative: thumbnail, scale: 2)
                    .resizable()
                    .scaledToFit()
            } else {
                RoundedRectangle(cornerRadius: 3).fill(.quaternary)
            }
        }
        .overlay {
            if lifted { Rectangle().strokeBorder(Color.accentColor, lineWidth: 2) }
        }
        .shadow(color: .black.opacity(lifted ? 0.3 : 0.15), radius: lifted ? 5 : 1.5, y: lifted ? 3 : 1)
        .overlay(alignment: .topLeading) {
            if hovering {
                HStack(spacing: 4) {
                    if let correct { hoverButton("Correct", systemImage: "crop", action: correct) }
                    if let delete { hoverButton("Delete", systemImage: "trash", action: delete) }
                }
                .padding(5)
                .transition(.opacity)
            }
        }
    }

    func hoverButton(_ title: LocalizedStringKey, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .labelStyle(.iconOnly)
                .font(.system(size: 10, weight: .semibold))
                .frame(width: 22, height: 22)
                .background(.regularMaterial, in: Circle())
                .overlay(Circle().strokeBorder(.separator))
                .shadow(color: .black.opacity(0.2), radius: 1, y: 0.5)
        }
        .buttonStyle(.plain)
        .help(title)
        .buttonHover()
    }

    var help: String {
        if case .failed(let error, _) = page.status { return ScannerText.message(for: error) }
        return ""
    }
}

struct ReviewBadge: View {
    let summary: String

    var body: some View {
        Image(systemName: "exclamationmark.triangle.fill")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 20, height: 20)
            .background(Color.orange, in: Circle())
            .help(summary)
            .accessibilityLabel("To check")
            .accessibilityValue(summary)
    }
}

struct NewDocumentSlot: View {
    var targeted = false

    var body: some View {
        Text("Drop a page here for a new document")
            .font(.caption2)
            .multilineTextAlignment(.center)
            .foregroundStyle(.secondary)
            .padding(8)
            .frame(width: 92, height: 130)
            .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(targeted ? Color.accentColor : Color.secondary.opacity(0.5), style: StrokeStyle(lineWidth: 2, dash: [6, 4])))
    }
}

extension View {
    func boardRow(hovered: Bool = false) -> some View {
        padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.primary.opacity(hovered ? 0.03 : 0), in: RoundedRectangle(cornerRadius: 12))
            .background(.background, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(.separator))
    }
}
