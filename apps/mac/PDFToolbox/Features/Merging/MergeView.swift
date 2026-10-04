import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct MergePreviewRequest: Identifiable {
    let id = UUID()
    /// Nil for the merged PDF.
    let file: UUID?
    let name: String
    let pageCount: Int
}

struct MergeView: View {
    @Environment(MergeSession.self) private var session
    @State private var importing = false
    @State private var confirmReset = false
    @State private var unlocking: MergeUnlockRequest?
    @State private var password = ""
    @State private var reorderAtEnd = false
    @State private var fileDropTarget = false
    @State private var previewing: MergePreviewRequest?

    var body: some View {
        VStack(spacing: 0) {
            if let error = session.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.red).font(.callout)
                    .padding().frame(maxWidth: .infinity, alignment: .leading)
                Divider()
            }
            if session.items.isEmpty { start } else { workspace }
        }
        .navigationTitle("Merge PDFs")
        .toolbar {
            ToolbarItemGroup {
                Button { importing = true } label: { Label("Add PDFs…", systemImage: "plus") }
                    .buttonHover().disabled(session.isBusy)
                Button(action: session.undo) { Label("Undo", systemImage: "arrow.uturn.backward") }
                    .buttonHover().disabled(!session.canUndo || session.isBusy)
                Button(action: requestReset) { Label("Clear the list", systemImage: "arrow.counterclockwise") }
                    .buttonHover().disabled(session.items.isEmpty || session.isBusy)
            }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf], allowsMultipleSelection: true) { result in
            if case .success(let urls) = result { session.add(urls) }
        }
        .contentShape(Rectangle())
        .onDrop(of: [.fileURL], delegate: dropDelegate())
        .overlay {
            if fileDropTarget && canReceiveDrop {
                RoundedRectangle(cornerRadius: 12).stroke(Color.accentColor, lineWidth: 3)
                    .padding(4).allowsHitTesting(false)
            }
        }
        .sheet(item: $previewing) { request in
            PagePreviewSheet(title: request.name, count: request.pageCount,
                             render: { page in
                                 if let file = request.file { try await session.pagePreview(id: file, pageIndex: page) }
                                 else { try await session.mergedPagePreview(at: page) }
                             },
                             message: MergeText.message)
        }
        .sheet(item: $unlocking, onDismiss: { password = "" }) { request in
            VStack(alignment: .leading, spacing: 18) {
                Text("Unlock this PDF").font(.brandTitle(26))
                Text(request.name).lineLimit(3).textSelection(.enabled)
                SecureField("PDF password", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { unlock(request.id) }
                Text("The merged copy will not require a password.")
                    .font(.callout).foregroundStyle(.secondary)
                HStack {
                    Spacer()
                    Button("Cancel", role: .cancel) { unlocking = nil }.keyboardShortcut(.cancelAction).buttonHover()
                    Button("Unlock PDF") { unlock(request.id) }
                        .keyboardShortcut(.defaultAction).buttonHover().disabled(password.isEmpty || session.isBusy)
                }
            }
            .padding(24).frame(width: 440)
        }
        .confirmationDialog("Clear all \(session.items.count) PDFs?", isPresented: $confirmReset) {
            Button("Clear the list", role: .destructive, action: session.reset)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The current list has not been saved as a merged PDF. Your original files will stay unchanged.")
        }
        .focusedSceneValue(\.toolMenu, menu)
    }

    private var menu: ToolMenu {
        guard !session.isBusy, !importing, !confirmReset, unlocking == nil, previewing == nil else {
            return ToolMenu(openTitle: "Add PDFs…")
        }
        return ToolMenu(openTitle: "Add PDFs…", open: { importing = true },
                        export: session.canExport ? { session.export() } : nil,
                        undo: session.canUndo ? { session.undo() } : nil)
    }

    private var start: some View {
        VStack(spacing: 20) {
            Image("monk-merge").resizable().scaledToFit().frame(height: 170).accessibilityHidden(true)
            Text("Bring your PDFs together").font(.brandTitle(30))
            Text("Drop your PDFs here, arrange them, then save one document.")
                .foregroundStyle(.secondary)
            Button("Choose PDFs…") { importing = true }
                .buttonStyle(.borderedProminent).controlSize(.large).buttonHover().disabled(session.isBusy)
            Text("Your documents stay on this Mac.").font(.callout).foregroundStyle(.secondary)
        }
        .padding(40).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var workspace: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Choose the document order").font(.headline)
                    Text("Drag files into the order you want, or use the arrows.").font(.callout).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Add PDFs…") { importing = true }.buttonHover().disabled(session.isBusy)
            }
            .padding(24)
            Divider()
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(Array(session.items.enumerated()), id: \.element.id) { index, item in
                        MergeFileRow(item: item, position: index + 1, count: session.items.count,
                                     canReceiveDrop: canReceiveDrop, preview: {
                            guard let info = item.information else { return }
                            previewing = MergePreviewRequest(file: item.id, name: item.name, pageCount: info.pageCount)
                        }, unlock: {
                            password = ""
                            unlocking = MergeUnlockRequest(id: item.id, name: item.name)
                        })
                    }
                }
                .padding(24)
                Color.clear.frame(height: 40).contentShape(Rectangle())
                    .dropDestination(for: String.self) { values, _ in
                        guard canReceiveDrop, let value = values.first,
                              let id = MergeDropSupport.decodeID(value),
                              session.items.contains(where: { $0.id == id }) else { return false }
                        session.move(id: id, to: .end)
                        reorderAtEnd = false
                        return true
                    } isTargeted: { reorderAtEnd = $0 }
                    .overlay(alignment: .top) {
                        if reorderAtEnd { Rectangle().fill(Color.accentColor).frame(height: 3).padding(.horizontal, 24) }
                    }
            }
            Divider()
            footer
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let progress = session.progressText {
                HStack { ProgressView().controlSize(.small); Text(progress).font(.callout) }
            }
            if let saved = session.lastSavedURL {
                HStack {
                    Label("Merged PDF saved", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                    Text(saved.lastPathComponent).lineLimit(1).truncationMode(.middle)
                    Spacer()
                    Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting([saved]) }.buttonHover()
                }
                .font(.callout)
            }
            ForEach(session.conservationNotices, id: \.self) { notice in
                Label(notice, systemImage: "info.circle")
                    .font(.callout).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(alignment: .center, spacing: 24) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 16) {
                        Text("PDF files: \(session.items.count)")
                        Text("Pages: \(session.totalPages)")
                    }
                    .font(.headline).monospacedDigit()
                    if session.hasEncryptedSources {
                        Label("The merged copy will not require a password.", systemImage: "lock.open")
                            .font(.callout).foregroundStyle(.secondary)
                    }
                    if !session.canExport && !session.isBusy {
                        Text("Add at least two PDFs, then unlock or remove any files that are not ready.")
                            .font(.callout).foregroundStyle(.secondary)
                    } else {
                        Text("Your original PDFs stay unchanged.").font(.callout).foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                HStack(spacing: 12) {
                    Button {
                        previewing = MergePreviewRequest(file: nil, name: String(localized: "Preview of the merged PDF"), pageCount: session.totalPages)
                    } label: {
                        Label("Preview", systemImage: "eye")
                    }
                    Button(action: session.export) {
                        Label("Save merged PDF…", systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .controlSize(.large)
                .buttonHover().disabled(!session.canExport || session.isBusy)
            }
        }
        .padding(24)
    }

    private var canReceiveDrop: Bool {
        !session.isBusy && unlocking == nil && previewing == nil && !importing && !confirmReset
    }

    private func dropDelegate() -> MergeDropDelegate {
        let generation = session.generation
        return MergeDropDelegate(isEnabled: { canReceiveDrop && session.generation == generation },
                                 onFiles: { session.add($0) }, onTarget: { fileDropTarget = $0 })
    }

    private func requestReset() {
        if session.hasUnexportedChanges { confirmReset = true } else { session.reset() }
    }

    private func unlock(_ id: UUID) {
        guard !password.isEmpty, !session.isBusy else { return }
        session.unlock(id: id, password: password)
        password = ""
        unlocking = nil
    }
}

private struct MergeFileRow: View {
    @Environment(MergeSession.self) private var session
    let item: MergeItem
    let position: Int
    let count: Int
    let canReceiveDrop: Bool
    var preview: () -> Void
    var unlock: () -> Void
    @State private var rowHeight: CGFloat = 100
    @State private var reorderTargeted = false

    private var previewID: UUID? {
        if case .ready(let info) = item.status { return info.id }
        return nil
    }

    var body: some View {
        HStack(spacing: 16) {
            Text(position, format: .number).font(.headline).monospacedDigit().foregroundStyle(.secondary)
                .frame(width: 28).accessibilityLabel("Position \(position)")
            Button(action: preview) {
                thumbnail.frame(width: 48, height: 64).contentShape(Rectangle())
            }
            .buttonStyle(.plain).buttonHover().disabled(previewID == nil || session.isBusy)
            .help("Preview PDF").accessibilityLabel("Preview \(item.name)")
            VStack(alignment: .leading, spacing: 6) {
                Text(item.name).font(.headline).lineLimit(2).truncationMode(.middle)
                HStack(spacing: 12) {
                    status
                    Text(ByteCountFormatter.string(fromByteCount: Int64(item.byteCount), countStyle: .file))
                        .foregroundStyle(.secondary)
                }
                .font(.callout)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if case .locked = item.status { Button("Unlock…", action: unlock).buttonHover().disabled(session.isBusy) }
            HStack(spacing: 6) {
                Button { session.moveUp(item.id) } label: { Label("Move up", systemImage: "arrow.up").labelStyle(.iconOnly) }
                    .buttonHover().disabled(position == 1 || session.isBusy)
                    .help("Move up")
                Button { session.moveDown(item.id) } label: { Label("Move down", systemImage: "arrow.down").labelStyle(.iconOnly) }
                    .buttonHover().disabled(position == count || session.isBusy)
                    .help("Move down")
                Button(role: .destructive) { session.remove(item.id) } label: {
                    Label("Remove \(item.name)", systemImage: "trash").labelStyle(.iconOnly)
                }
                .buttonHover().disabled(session.isBusy)
                .help("Remove from the list")
            }
        }
        .padding(16)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10)
            .stroke(reorderTargeted ? Color.accentColor : Color(nsColor: .separatorColor), lineWidth: reorderTargeted ? 2 : 1)
            .allowsHitTesting(false))
        .accessibilityElement(children: .contain)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { rowHeight = $0 }
        .contentShape(Rectangle())
        .draggable(MergeDropSupport.payload(for: item.id))
        .dropDestination(for: String.self) { values, point in
            guard canReceiveDrop, let value = values.first,
                  let id = MergeDropSupport.decodeID(value),
                  session.items.contains(where: { $0.id == id }) else { return false }
            session.move(id: id, to: MergeDropSupport.position(rowID: item.id, rowHeight: rowHeight, location: point))
            return true
        } isTargeted: { reorderTargeted = $0 && canReceiveDrop }
        .task(id: previewID) {
            if previewID != nil { await session.loadPreview(id: item.id) }
        }
    }

    @ViewBuilder private var thumbnail: some View {
        if let preview = item.preview {
            Image(decorative: preview, scale: 1).resizable().scaledToFit()
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: 4).fill(Color(nsColor: .windowBackgroundColor))
                if case .loading = item.status {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: "doc.richtext").font(.title2).foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder private var status: some View {
        switch item.status {
        case .loading:
            Text("Reading PDF…").foregroundStyle(.secondary)
        case .locked:
            Label("Password required", systemImage: "lock").foregroundStyle(.secondary)
        case .ready(let info):
            if info.pageCount == 1 { Text("1 page").foregroundStyle(.secondary) }
            else { Text("\(info.pageCount) pages").foregroundStyle(.secondary) }
        case .failed(let message):
            Label(message, systemImage: "exclamationmark.triangle").foregroundStyle(.red)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct MergeUnlockRequest: Identifiable {
    let id: UUID
    let name: String
}
