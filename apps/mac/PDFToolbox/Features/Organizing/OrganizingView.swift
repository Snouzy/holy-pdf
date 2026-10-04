import AppKit
import PDFCore
import SwiftUI
import UniformTypeIdentifiers

struct OrganizingPreviewRequest: Identifiable { let id: Int }

struct OrganizingView: View {
    @Environment(OrganizingSession.self) private var session
    @State private var importing = false
    @State private var confirmingReplacement = false
    @State private var pendingURL: URL?
    @State private var previewing: OrganizingPreviewRequest?
    @State private var password = ""
    @State private var fileTarget = false
    @State private var endTarget = false
    @State private var dragNamespace = UUID()

    private var dragPrefix: String { "holy-pdf-organize:\(dragNamespace):\(session.generation):" }
    private var interactive: Bool { !session.isBusy && !importing && !confirmingReplacement && previewing == nil }

    var body: some View {
        VStack(spacing: 0) {
            if let error = session.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.red).font(.callout).padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if session.needsPassword { passwordForm }
            else if session.pages.isEmpty {
                if session.isBusy { ProgressView("Reading PDF…").frame(maxWidth: .infinity, maxHeight: .infinity) }
                else { start }
            } else { workspace }
        }
        .navigationTitle("Organize pages")
        .toolbar {
            ToolbarItemGroup {
                Button { importing = true } label: { Label("Open PDF…", systemImage: "folder") }
                    .buttonHover().disabled(!interactive)
                Button(action: session.undo) { Label("Undo", systemImage: "arrow.uturn.backward") }
                    .buttonHover().disabled(!interactive || !session.canUndo)
                Button { requestOpen(nil) } label: { Label("Close PDF", systemImage: "xmark") }
                    .buttonHover().disabled(!interactive || session.documentName == nil)
            }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf]) { result in
            switch result {
            case .success(let url): requestOpen(url)
            case .failure(let error): session.errorMessage = error.localizedDescription
            }
        }
        .contentShape(Rectangle())
        .onDrop(of: [.fileURL], delegate: fileDropDelegate())
        .overlay {
            if fileTarget && interactive {
                RoundedRectangle(cornerRadius: 12).stroke(Color.accentColor, lineWidth: 3)
                    .padding(4).allowsHitTesting(false)
            }
        }
        .confirmationDialog("Discard unsaved page changes?", isPresented: $confirmingReplacement) {
            Button("Discard changes", role: .destructive) { replaceDocument() }
            Button("Cancel", role: .cancel) { pendingURL = nil }
        } message: { Text("Your original PDF will stay unchanged.") }
        .sheet(item: $previewing) { request in
            PagePreviewSheet(title: session.documentName ?? "", count: session.pages.count,
                             start: session.pages.firstIndex(where: { $0.id == request.id }) ?? 0,
                             rotation: { session.pages[$0].rotation },
                             render: { try await session.pagePreview(pageID: session.pages[$0].id) },
                             message: OrganizingText.message)
        }
        .focusedSceneValue(\.toolMenu, ToolMenu(
            openTitle: "Open PDF…",
            open: interactive ? { importing = true } : nil,
            export: interactive && session.canExport ? { session.export() } : nil,
            undo: interactive && session.canUndo ? { session.undo() } : nil))
    }

    private var start: some View {
        VStack(spacing: 20) {
            Image("monk-organize").resizable().scaledToFit().frame(height: 170).accessibilityHidden(true)
            Text("Every page in its place").font(.brandTitle(30))
            Text("Drop a PDF here to reorder, rotate or remove its pages.").foregroundStyle(.secondary)
            Button("Choose a PDF…") { importing = true }
                .buttonStyle(.borderedProminent).controlSize(.large).buttonHover()
            Text("Your documents stay on this Mac.").font(.callout).foregroundStyle(.secondary)
        }
        .padding(40).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var passwordForm: some View {
        VStack(alignment: .leading, spacing: 18) {
            Label("Unlock this PDF", systemImage: "lock").font(.brandTitle(26))
            Text(session.documentName ?? "").lineLimit(2)
            SecureField("PDF password", text: $password).textFieldStyle(.roundedBorder)
                .onSubmit(unlock)
            Text("The saved copy will not require a password.").font(.callout).foregroundStyle(.secondary)
            HStack {
                Button("Cancel") { password = ""; session.reset() }.buttonHover()
                Spacer()
                Button("Unlock PDF", action: unlock).buttonStyle(.borderedProminent)
                    .buttonHover().disabled(password.isEmpty || session.isBusy)
            }
        }
        .padding(32).frame(maxWidth: 480).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var workspace: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.documentName ?? "").font(.headline).lineLimit(1).truncationMode(.middle)
                    Text("Drag pages into order, or use the arrows. Click a page to preview it.")
                        .font(.callout).foregroundStyle(.secondary)
                }
                Spacer()
                Text("Pages: \(session.pages.count)").monospacedDigit().foregroundStyle(.secondary)
            }
            .padding(20)
            Divider()
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180, maximum: 240), spacing: 16)], spacing: 16) {
                    ForEach(Array(session.pages.enumerated()), id: \.element.id) { index, page in
                        OrganizingPageCard(page: page, position: index, count: session.pages.count,
                                           enabled: interactive, dragPrefix: dragPrefix,
                                           preview: { previewing = OrganizingPreviewRequest(id: page.id) },
                                           receive: { values, after in receive(values, target: page.id, after: after) })
                    }
                }
                .animation(.snappy(duration: 0.25), value: session.pages.map(\.id))
                .padding(20)
                Color.clear.frame(height: 48)
                    .overlay {
                        Text("Drop here to move to the end")
                            .font(.callout).foregroundStyle(endTarget ? Color.accentColor : .secondary)
                            .allowsHitTesting(false)
                    }
                    .background(endTarget ? Color.accentColor.opacity(0.1) : Color.clear)
                    .contentShape(Rectangle())
                    .dropDestination(for: String.self) { values, _ in receive(values, target: nil) }
                        isTargeted: { endTarget = $0 && interactive }
                    .padding(.horizontal, 20).padding(.bottom, 16)
            }
            .id(session.generation)
            Divider()
            footer
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let saved = session.lastSavedURL {
                HStack {
                    Label("PDF saved", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                    Text(saved.lastPathComponent).lineLimit(1).truncationMode(.middle)
                    Spacer()
                    Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting([saved]) }.buttonHover()
                }.font(.callout)
            }
            ForEach(session.conservationNotices, id: \.self) { notice in
                Label(notice, systemImage: "info.circle").font(.callout).foregroundStyle(.secondary)
            }
            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Your original PDF will stay unchanged.").font(.callout).foregroundStyle(.secondary)
                    if session.isEncrypted {
                        Label("The saved copy will not require a password.", systemImage: "lock.open")
                            .font(.callout).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if session.isBusy { ProgressView().controlSize(.small) }
                Button(action: session.export) { Label("Save organized PDF…", systemImage: "square.and.arrow.down") }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .buttonHover().disabled(!interactive || !session.canExport)
            }
        }.padding(20)
    }

    private func receive(_ values: [String], target: Int?, after: Bool = false) -> Bool {
        guard interactive, let value = values.first,
              let id = OrganizingDropSupport.pageID(value, prefix: dragPrefix),
              session.pages.contains(where: { $0.id == id }) else { return false }
        guard target != id else { return true }
        let destination = OrganizingDropSupport.destination(source: id, target: target, after: after, order: session.pages.map(\.id))
        session.move(id: id, before: destination)
        return true
    }

    private func requestOpen(_ url: URL?) {
        guard !session.isBusy else { return }
        pendingURL = url
        if session.hasUnexportedChanges { confirmingReplacement = true }
        else { replaceDocument() }
    }

    private func fileDropDelegate() -> MergeDropDelegate {
        let generation = session.generation
        return MergeDropDelegate(isEnabled: { interactive && session.generation == generation },
                                 onFiles: { urls in if let url = urls.first { requestOpen(url) } },
                                 onTarget: { fileTarget = $0 })
    }

    private func replaceDocument() {
        password = ""
        if let url = pendingURL { session.open(url) } else { session.reset() }
        pendingURL = nil
    }

    private func unlock() {
        guard !password.isEmpty, !session.isBusy else { return }
        session.unlock(password: password)
        password = ""
    }
}

struct OrganizingPageCard: View {
    @Environment(OrganizingSession.self) private var session
    let page: OrganizedPage
    let position: Int
    let count: Int
    let enabled: Bool
    let dragPrefix: String
    let preview: () -> Void
    let receive: ([String], Bool) -> Bool
    @State private var image: CGImage?
    @State private var visible = false
    @State private var insertAfter: Bool?

    var body: some View {
        VStack(spacing: 10) {
            Button(action: preview) {
                ZStack {
                    Color(nsColor: .underPageBackgroundColor)
                    if let image { OrganizedPageImage(image: image, rotation: page.rotation).padding(10) }
                    else { Image(systemName: "doc.richtext").font(.largeTitle).foregroundStyle(.tertiary) }
                }
                .frame(height: 180).clipShape(RoundedRectangle(cornerRadius: 6)).contentShape(Rectangle())
            }
            .buttonStyle(.plain).buttonHover().disabled(!enabled)
            .accessibilityLabel("Preview source page \(page.id + 1)")
            HStack {
                Text("Page \(position + 1)").font(.headline).monospacedDigit()
                Spacer()
                Text("Source: \(page.id + 1)").font(.caption).foregroundStyle(.secondary)
            }
            HStack(spacing: 4) {
                Button { session.moveLeft(id: page.id) } label: { Label("Move earlier", systemImage: "arrow.left").labelStyle(.iconOnly) }
                    .buttonHover().disabled(!enabled || position == 0).help("Move earlier")
                Button { session.moveRight(id: page.id) } label: { Label("Move later", systemImage: "arrow.right").labelStyle(.iconOnly) }
                    .buttonHover().disabled(!enabled || position + 1 == count).help("Move later")
                Spacer(minLength: 0)
                Button { session.rotate(id: page.id) } label: { Label("Rotate clockwise", systemImage: "rotate.right").labelStyle(.iconOnly) }
                    .buttonHover().disabled(!enabled).help("Rotate clockwise")
                Button(role: .destructive) { session.remove(id: page.id) } label: { Label("Delete page", systemImage: "trash").labelStyle(.iconOnly) }
                    .buttonHover().disabled(!enabled || count <= 1).help("Delete page")
            }
            .controlSize(.small)
        }
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color(nsColor: .separatorColor)).allowsHitTesting(false))
        .overlay(alignment: insertAfter == true ? .trailing : .leading) {
            if let insertAfter {
                // Centred in the 16-point gap between two cards: the same place for « after this card » and « before the next ».
                Capsule().fill(Color.accentColor).frame(width: 4).padding(.vertical, 6)
                    .offset(x: insertAfter ? 10 : -10).allowsHitTesting(false)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("organize-page-\(page.id)")
        .contentShape(Rectangle())
        // Each half reaches into the gaps around the card, so no drop falls between two cards.
        .background { HStack(spacing: 0) { dropHalf(after: false); dropHalf(after: true) }.padding(-8) }
        .draggable(dragPrefix + String(page.id))
        .onAppear { visible = true }
        .onDisappear { visible = false; image = nil }
        .task(id: visible) {
            guard visible else { return }
            let rendered = await session.thumbnail(pageID: page.id)
            guard !Task.isCancelled, visible else { return }
            image = rendered
        }
    }

    private func dropHalf(after: Bool) -> some View {
        Color.clear.contentShape(Rectangle())
            .dropDestination(for: String.self) { values, _ in receive(values, after) }
                isTargeted: { targeted in
                    if targeted && enabled { insertAfter = after } else if insertAfter == after { insertAfter = nil }
                }
    }
}

enum OrganizingDropSupport {
    static func pageID(_ payload: String, prefix: String) -> Int? {
        guard payload.hasPrefix(prefix), let id = Int(payload.dropFirst(prefix.count)), id >= 0 else { return nil }
        return id
    }

    static func destination(source: Int, target: Int?, after: Bool, order: [Int]) -> Int? {
        guard let target else { return nil }
        guard after else { return target }
        let remaining = order.filter { $0 != source }
        guard let index = remaining.firstIndex(of: target), index + 1 < remaining.count else { return nil }
        return remaining[index + 1]
    }
}

struct OrganizedPageImage: View {
    let image: CGImage
    let rotation: Int

    var body: some View {
        GeometryReader { proxy in
            let sideways = rotation % 180 != 0
            let width = CGFloat(sideways ? image.height : image.width)
            let height = CGFloat(sideways ? image.width : image.height)
            let scale = min(proxy.size.width / width, proxy.size.height / height)
            Image(decorative: image, scale: 1).resizable()
                .frame(width: CGFloat(image.width) * scale, height: CGFloat(image.height) * scale)
                .rotationEffect(.degrees(Double(rotation)))
                .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
        }
    }
}
