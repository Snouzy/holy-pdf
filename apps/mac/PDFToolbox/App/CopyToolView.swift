import AppKit
import SwiftUI
import UniformTypeIdentifiers

/// The screen of a tool that saves a changed copy of one PDF: the page on the left, the tool's settings on the right.
struct CopyToolView<Panel: View>: View {
    let file: PDFCopySession
    let tool: Tool
    let startTitle: LocalizedStringKey
    let startHint: LocalizedStringKey
    /// Nil for a tool that saves from its own panel: several files in a folder, for instance.
    var saveTitle: LocalizedStringKey?
    var savedTitle: LocalizedStringKey?
    var workingTitle: LocalizedStringKey?
    var canSave = true
    /// What « Undo » of the Edit menu does. Nil when there is nothing to take back.
    var undo: (() -> Void)?
    /// What « Redo » of the Edit menu does.
    var redo: (() -> Void)?
    /// « The saved copy will not require a password. » Protect and Unlock say what happens to the password themselves.
    var passwordNote = true
    /// Laid over the page, at its size: where a tool lets the user work on the page itself.
    var onPage: AnyView?
    let save: () -> Void
    @ViewBuilder let panel: Panel
    @State private var importing = false
    @State private var confirmReplacement = false
    @State private var droppedURL: URL?

    var body: some View {
        VStack(spacing: 0) {
            if let error = file.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.red).font(.callout).padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                Divider()
            }
            switch file.state {
            case .empty: start
            case .opening: ProgressView("Opening PDF…").frame(maxWidth: .infinity, maxHeight: .infinity)
            case .locked: PasswordPrompt(name: file.sourceName, passwordNote: passwordNote, unlock: file.unlock)
            case .ready, .working, .choosingDestination, .exporting: workspace
            }
        }
        .navigationTitle(tool.title)
        .toolbar {
            ToolbarItemGroup {
                Button(action: requestOpen) { Label("Open PDF…", systemImage: "folder") }
                    .buttonHover().disabled(file.isBusy)
            }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf]) { result in
            if case .success(let url) = result { file.open(url) }
        }
        .confirmationDialog("Discard changes to \(file.sourceName)?", isPresented: $confirmReplacement) {
            Button("Discard changes", role: .destructive) { completeOpen() }
            Button("Cancel", role: .cancel) { droppedURL = nil }
        } message: {
            Text("Your changes have not been saved. Opening another PDF will discard them.")
        }
        .dropDestination(for: URL.self) { urls, _ in
            urls.first.map(dropPDF) ?? false
        }
        .focusedSceneValue(\.toolMenu, menu)
    }

    private var menu: ToolMenu {
        guard !file.isBusy, !importing, !confirmReplacement else { return ToolMenu(openTitle: "Open PDF…") }
        return ToolMenu(openTitle: "Open PDF…", open: requestOpen, export: file.state == .ready && canSave ? save : nil, undo: undo, redo: redo)
    }

    private var start: some View {
        VStack(spacing: 20) {
            Image(tool.imageName).resizable().scaledToFit().frame(height: 170).accessibilityHidden(true)
            Text(startTitle).font(.brandTitle(30))
            Text(startHint).foregroundStyle(.secondary)
            Button("Choose a PDF…", action: requestOpen).buttonStyle(.borderedProminent).controlSize(.large).buttonHover()
            Text("Your documents stay on this Mac.").font(.callout).foregroundStyle(.secondary)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var workspace: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                PagePreviewPane(file: file, onPage: onPage)
                    .environment(\.dropPDF, dropPDF)
                Divider()
                PageStepper(index: file.pageIndex, count: file.pageSizes.count, go: file.goToPage)
            }
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(file.sourceName).font(.headline).lineLimit(3).textSelection(.enabled)
                    Divider()
                    panel
                    Divider()
                    ForEach(file.notices, id: \.self) { notice in
                        Label(notice, systemImage: "info.circle").font(.callout).foregroundStyle(.secondary)
                    }
                    Text("Your original PDF stays unchanged.").font(.callout).foregroundStyle(.secondary)
                    if file.isEncrypted, passwordNote {
                        Label("The saved copy will not require a password.", systemImage: "lock.open").font(.callout).foregroundStyle(.secondary)
                    }
                    if let saveTitle {
                        Button(action: save) { Label(saveTitle, systemImage: "square.and.arrow.down").frame(maxWidth: .infinity) }
                            .buttonStyle(.borderedProminent).controlSize(.large).buttonHover().disabled(!canSave)
                    }
                    if file.state == .exporting { ProgressView("Saving the PDF…") }
                    if let saved = file.lastSavedURL, let savedTitle {
                        Label(savedTitle, systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                        Text(saved.lastPathComponent).font(.callout).lineLimit(2).textSelection(.enabled)
                        Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting([saved]) }.buttonHover()
                    }
                }
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: 320)
        }
        .disabled(file.isBusy)
        // Outside the disabled workspace, or the button could not be clicked.
        .overlay(alignment: .bottomTrailing) {
            if file.state == .working {
                HStack(spacing: 10) {
                    ProgressView().controlSize(.small)
                    if let workingTitle { Text(workingTitle) }
                    Spacer()
                    Button("Cancel", action: file.cancelWork).keyboardShortcut(.cancelAction).buttonHover()
                }
                .padding(16)
                .frame(width: 320)
                .background(.bar)
            }
        }
    }

    private func dropPDF(_ url: URL) -> Bool {
        guard !file.isBusy, url.pathExtension.lowercased() == "pdf" else { return false }
        droppedURL = url
        if file.hasUnsavedEdits { confirmReplacement = true } else { completeOpen() }
        return true
    }

    private func requestOpen() {
        droppedURL = nil
        if file.hasUnsavedEdits { confirmReplacement = true } else { importing = true }
    }

    private func completeOpen() {
        if let url = droppedURL { file.open(url) } else { importing = true }
        droppedURL = nil
    }
}

struct PagePreviewPane: View {
    let file: PDFCopySession
    var onPage: AnyView?

    var body: some View {
        GeometryReader { geometry in
            if file.pageSizes.indices.contains(file.pageIndex) {
                let page = file.pageSizes[file.pageIndex]
                let scale = min(max(1, geometry.size.width - 48) / page.width, max(1, geometry.size.height - 48) / page.height)
                ZStack {
                    Color.white
                    if let preview = file.preview { Image(decorative: preview, scale: 1).resizable() } else { ProgressView() }
                    onPage
                }
                .frame(width: page.width * scale, height: page.height * scale)
                .shadow(color: .black.opacity(0.12), radius: 5, y: 2)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color(nsColor: .underPageBackgroundColor))
    }
}

extension EnvironmentValues {
    /// For a view on the page that takes file drops itself: a PDF dropped there opens as on the rest of the screen.
    @Entry var dropPDF: ((URL) -> Bool)? = nil
}
