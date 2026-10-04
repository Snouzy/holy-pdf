import AppKit
import PDFCore
import SwiftUI
import UniformTypeIdentifiers

struct PagePickingView: View {
    let session: PagePickingSession
    @State private var importing = false
    @State private var confirmingReplacement = false
    @State private var pendingURL: URL?
    @State private var previewing: OrganizingPreviewRequest?
    @State private var fileTarget = false
    @State private var pagesPerFile = 1

    private var deck: OrganizingSession { session.deck }
    private var split: Bool { session.mode == .split }
    private var tool: Tool { split ? .split : .extract }
    private var interactive: Bool { !session.isBusy && !importing && !confirmingReplacement && previewing == nil }

    // A ternary of two literals is a String: SwiftUI would not look it up in the string catalog.
    private func text(split: LocalizedStringKey, extract: LocalizedStringKey) -> LocalizedStringKey {
        self.split ? split : extract
    }

    var body: some View {
        VStack(spacing: 0) {
            if let error = deck.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.red).font(.callout).padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if deck.needsPassword {
                PasswordPrompt(name: deck.documentName ?? "") { deck.unlock(password: $0) }
            } else if session.pageCount == 0 {
                if deck.isBusy { ProgressView("Reading PDF…").frame(maxWidth: .infinity, maxHeight: .infinity) }
                else { start }
            } else { workspace }
        }
        .navigationTitle(tool.title)
        .toolbar {
            ToolbarItemGroup {
                Button { importing = true } label: { Label("Open PDF…", systemImage: "folder") }
                    .buttonHover().disabled(!interactive)
                Button(action: session.undo) { Label("Undo", systemImage: "arrow.uturn.backward") }
                    .buttonHover().disabled(!interactive || !session.canUndo)
                Button { requestOpen(nil) } label: { Label("Close PDF", systemImage: "xmark") }
                    .buttonHover().disabled(!interactive || deck.documentName == nil)
            }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf]) { result in
            switch result {
            case .success(let url): requestOpen(url)
            case .failure(let error): deck.errorMessage = error.localizedDescription
            }
        }
        .contentShape(Rectangle())
        .onDrop(of: [.fileURL], delegate: MergeDropDelegate(
            isEnabled: { interactive },
            onFiles: { urls in if let url = urls.first { requestOpen(url) } },
            onTarget: { fileTarget = $0 }))
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
            PagePreviewSheet(title: deck.documentName ?? "", count: session.pageCount, start: request.id,
                             render: { try await deck.pagePreview(pageID: $0) }, message: PickingText.message)
        }
        .focusedSceneValue(\.toolMenu, ToolMenu(
            openTitle: "Open PDF…",
            open: interactive ? { importing = true } : nil,
            export: interactive && session.canExport ? { session.export() } : nil,
            undo: interactive && session.canUndo ? { session.undo() } : nil))
    }

    private var start: some View {
        VStack(spacing: 20) {
            Image(tool.imageName).resizable().scaledToFit().frame(height: 170).accessibilityHidden(true)
            Text(text(split: "One snip, clean and neat", extract: "Keep only the best")).font(.brandTitle(30))
            Text(text(split: "Drop a PDF here to cut it into several files.",
                      extract: "Drop a PDF here to pull out the pages you choose."))
                .foregroundStyle(.secondary)
            Button("Choose a PDF…") { importing = true }
                .buttonStyle(.borderedProminent).controlSize(.large).buttonHover()
            Text("Your documents stay on this Mac.").font(.callout).foregroundStyle(.secondary)
        }
        .padding(40).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var workspace: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(deck.documentName ?? "").font(.headline).lineLimit(1).truncationMode(.middle)
                    Text(text(split: "Click the scissors between two pages to cut there. Click a page to preview it.",
                              extract: "Click the pages to keep. The eye previews a page."))
                        .font(.callout).foregroundStyle(.secondary)
                }
                Spacer()
                controls.disabled(!interactive)
            }
            .padding(20)
            Divider()
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 170, maximum: 220), spacing: PickablePageCard.gap(split: split))], spacing: 16) {
                    ForEach(0..<session.pageCount, id: \.self) { page in
                        PickablePageCard(session: session, page: page, enabled: interactive,
                                         preview: { previewing = OrganizingPreviewRequest(id: page) })
                    }
                }
                .padding(.horizontal, split ? 48 : 20).padding(.vertical, 20)
            }
            .id(deck.generation)
            .onChange(of: deck.generation) { pagesPerFile = 1 }
            Divider()
            footer
        }
    }

    @ViewBuilder private var controls: some View {
        if split {
            HStack(spacing: 8) {
                Stepper(value: $pagesPerFile, in: 1...max(1, session.pageCount - 1)) {
                    Text("Pages per file: \(pagesPerFile)").monospacedDigit()
                }
                Button("Apply") { session.cutEvery(pagesPerFile) }.buttonHover()
                Button("Remove the cuts") { session.pickNone() }.buttonHover().disabled(session.picked.isEmpty)
            }
        } else {
            HStack(spacing: 8) {
                Text("Selected: \(session.picked.count)").monospacedDigit().foregroundStyle(.secondary)
                Button("Select all") { session.pickAll() }.buttonHover()
                Button("Select none") { session.pickNone() }.buttonHover().disabled(session.picked.isEmpty)
            }
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !session.savedURLs.isEmpty && !session.isSaving && deck.errorMessage == nil {
                HStack {
                    Group {
                        if split { Label("\(session.savedURLs.count) PDFs saved", systemImage: "checkmark.circle.fill") }
                        else { Label("PDF saved", systemImage: "checkmark.circle.fill") }
                    }.foregroundStyle(.green)
                    if !split { Text(session.savedURLs[0].lastPathComponent).lineLimit(1).truncationMode(.middle) }
                    Spacer()
                    Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting(session.savedURLs) }.buttonHover()
                }.font(.callout)
            }
            ForEach(deck.conservationNotices, id: \.self) { notice in
                Label(notice, systemImage: "info.circle").font(.callout).foregroundStyle(.secondary)
            }
            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Your original PDF will stay unchanged.").font(.callout).foregroundStyle(.secondary)
                    if deck.isEncrypted {
                        Label(text(split: "The saved copies will not require a password.",
                                   extract: "The saved copy will not require a password."), systemImage: "lock.open")
                            .font(.callout).foregroundStyle(.secondary)
                    }
                    if session.picked.isEmpty {
                        Text(split && session.pageCount == 1 ? "This PDF has a single page: there is nothing to split."
                             : text(split: "Place at least one cut to split the PDF.", extract: "Select at least one page to save a PDF."))
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if session.isSaving {
                    ProgressView().controlSize(.small)
                    if split { Text("Saving file \(session.savedURLs.count + 1) of \(session.parts.count)…").font(.callout).monospacedDigit() }
                }
                Button(action: session.export) { Label(exportTitle, systemImage: split ? "scissors" : "square.and.arrow.down") }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .buttonHover().disabled(!interactive || !session.canExport)
            }
        }.padding(20)
    }

    private var exportTitle: LocalizedStringKey {
        guard split else { return "Save the selection…" }
        return session.picked.isEmpty ? "Split…" : "Split into \(session.parts.count) PDFs…"
    }

    private func requestOpen(_ url: URL?) {
        guard !session.isBusy else { return }
        pendingURL = url
        if session.hasUnexportedChanges { confirmingReplacement = true }
        else { replaceDocument() }
    }

    private func replaceDocument() {
        if let url = pendingURL { session.open(url) } else { session.reset() }
        pendingURL = nil
    }
}

struct PickablePageCard: View {
    let session: PagePickingSession
    let page: Int
    let enabled: Bool
    let preview: () -> Void
    @State private var image: CGImage?
    @State private var visible = false

    /// The space between two cards: wider in Split, where the scissors button sits in it.
    static func gap(split: Bool) -> CGFloat { split ? 36 : 16 }

    private var split: Bool { session.mode == .split }
    private var picked: Bool { session.picked.contains(page) }
    private var kept: Bool { !split && picked }

    var body: some View {
        VStack(spacing: 8) {
            Button(action: split ? preview : { session.toggle(page) }) {
                ZStack {
                    Color(nsColor: .underPageBackgroundColor)
                    if let image { OrganizedPageImage(image: image, rotation: 0).padding(10) }
                    else { Image(systemName: "doc.richtext").font(.largeTitle).foregroundStyle(.tertiary) }
                }
                .frame(height: 170).clipShape(RoundedRectangle(cornerRadius: 6)).contentShape(Rectangle())
                .overlay(alignment: .topTrailing) {
                    if kept {
                        Image(systemName: "checkmark.circle.fill").font(.title2)
                            .symbolRenderingMode(.palette).foregroundStyle(.white, Color.accentColor).padding(6)
                    }
                }
            }
            .buttonStyle(.plain).buttonHover().disabled(!enabled)
            HStack {
                Text("Page \(page + 1)").font(.headline).monospacedDigit()
                Spacer()
                if split {
                    Text("File \(session.part(of: page) + 1)").font(.caption).monospacedDigit().foregroundStyle(.secondary)
                } else {
                    Button(action: preview) { Label("Preview page", systemImage: "eye").labelStyle(.iconOnly) }
                        .buttonHover().controlSize(.small).disabled(!enabled).help("Preview page")
                }
            }
        }
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12))
        // Every other file is tinted, so the reader sees where each one starts and ends.
        .background(Color.accentColor.opacity(split && !session.part(of: page).isMultiple(of: 2) ? 0.25 : 0), in: RoundedRectangle(cornerRadius: 12).inset(by: -4))
        .overlay(RoundedRectangle(cornerRadius: 12)
            .strokeBorder(kept ? Color.accentColor : Color(nsColor: .separatorColor), lineWidth: kept ? 2 : 1).allowsHitTesting(false))
        .overlay(alignment: .trailing) {
            if split && page < session.pageCount - 1 { cut.offset(x: Self.gap(split: true) / 2 + 13) }
        }
        .onAppear { visible = true }
        .onDisappear { visible = false; image = nil }
        .task(id: visible) {
            guard visible else { return }
            let rendered = await session.deck.thumbnail(pageID: page)
            guard !Task.isCancelled, visible else { return }
            image = rendered
        }
    }

    private var cut: some View {
        let help: LocalizedStringKey = picked ? "Remove this cut" : "Cut after this page"
        return Button { session.toggle(page) } label: {
            Image(systemName: "scissors").font(.system(size: 12, weight: .bold))
                .foregroundStyle(picked ? Color.white : Color.secondary)
                .frame(width: 26, height: 26)
                .background(picked ? Color.accentColor : Color(nsColor: .controlBackgroundColor), in: Circle())
                .overlay(Circle().strokeBorder(picked ? Color.accentColor : Color(nsColor: .separatorColor)))
        }
        .buttonStyle(.plain).buttonHover().disabled(!enabled)
        .help(help)
    }
}
