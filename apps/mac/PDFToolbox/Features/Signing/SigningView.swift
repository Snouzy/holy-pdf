import AppKit
import PDFCore
import SwiftUI
import UniformTypeIdentifiers

struct SigningView: View {
    @Environment(SigningSession.self) private var session
    @State private var importingPDF = false
    @State private var drawingSignature = false
    @State private var confirmReplacement = false
    @State private var droppedURL: URL?
    @State private var text = ""
    @State private var style = SignatureImage.TextStyle.handwritten

    private var busy: Bool {
        switch session.state {
        case .opening, .exporting: true
        default: false
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            if let error = session.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.red)
                    .font(.callout)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityAddTraits(.updatesFrequently)
                Divider()
            }
            switch session.state {
            case .empty:
                start
            case .opening:
                ProgressView("Opening PDF…").frame(maxWidth: .infinity, maxHeight: .infinity)
            case .locked:
                PasswordPrompt(name: session.sourceName, unlock: session.unlock)
            case .ready, .exporting:
                workspace
            }
        }
        .navigationTitle("Sign a PDF")
        .toolbar {
            ToolbarItemGroup {
                Button(action: requestOpen) { Label("Open PDF…", systemImage: "folder") }
                    .buttonHover()
                    .disabled(busy)
                Button(action: session.undo) { Label("Undo", systemImage: "arrow.uturn.backward") }
                    .buttonHover()
                    .disabled(!session.canUndo || busy)
            }
        }
        .fileImporter(isPresented: $importingPDF, allowedContentTypes: [.pdf]) { result in
            if case .success(let url) = result { session.open(url) }
        }
        .sheet(isPresented: $drawingSignature) {
            SignatureDrawingView(onUse: session.addSignature, onImport: session.importSignature)
        }
        .confirmationDialog("Discard changes to \(session.sourceName)?", isPresented: $confirmReplacement) {
            Button("Discard changes", role: .destructive) { completeOpen() }
            Button("Cancel", role: .cancel) { droppedURL = nil }
        } message: {
            Text("The signature placements have not been saved. Opening another PDF will discard them.")
        }
        .dropDestination(for: URL.self) { urls, _ in
            guard !busy, let url = urls.first, url.pathExtension.lowercased() == "pdf" else { return false }
            droppedURL = url
            if session.hasUnexportedChanges { confirmReplacement = true } else { completeOpen() }
            return true
        }
        .focusedSceneValue(\.toolMenu, menu)
    }

    private var menu: ToolMenu {
        guard !busy, !drawingSignature, !importingPDF, !confirmReplacement else { return ToolMenu(openTitle: "Open PDF…") }
        return ToolMenu(openTitle: "Open PDF…", open: requestOpen,
                        export: session.canExport ? { session.export() } : nil,
                        undo: session.canUndo ? { session.undo() } : nil)
    }

    private var start: some View {
        VStack(spacing: 20) {
            Image("monk-sign").resizable().scaledToFit().frame(height: 170).accessibilityHidden(true)
            Text("Sign your PDF, on your Mac").font(.brandTitle(30))
            Text("Drop a PDF here, then draw or import your signature.")
                .foregroundStyle(.secondary)
            Button("Choose a PDF…", action: requestOpen).buttonStyle(.borderedProminent).controlSize(.large)
                .buttonHover()
            Text("Your documents stay on this Mac.").font(.callout).foregroundStyle(.secondary)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var workspace: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                SignaturePageView()
                Divider()
                PageStepper(index: session.pageIndex, count: session.pageSizes.count, go: session.goToPage)
            }
            .disabled(busy)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(session.sourceName).font(.headline).lineLimit(3).textSelection(.enabled)
                    Divider()
                    Text("Your marks").font(.headline)
                    if session.marks.isEmpty {
                        Text("Draw a signature, import an image or type a line, then place it on the pages as often as you like.")
                            .font(.callout).foregroundStyle(.secondary)
                    }
                    ForEach(session.marks) { mark in
                        HStack(spacing: 10) {
                            Image(decorative: mark.preview, scale: 1).resizable().scaledToFit()
                                .frame(width: 96, height: 36).padding(6).background(.white, in: RoundedRectangle(cornerRadius: 6))
                            Text(mark.title).lineLimit(1)
                            Spacer()
                            Button { session.removeMark(mark.id) } label: { Label("Remove this mark", systemImage: "trash").labelStyle(.iconOnly) }
                                .buttonStyle(.borderless).buttonHover()
                        }
                        .padding(6)
                        .background(session.currentMarkID == mark.id ? Color.accentColor.opacity(0.15) : .clear, in: RoundedRectangle(cornerRadius: 8))
                        .contentShape(Rectangle())
                        .onTapGesture { session.selectMark(mark.id) }
                        .accessibilityElement(children: .combine)
                        .accessibilityAddTraits(session.currentMarkID == mark.id ? [.isButton, .isSelected] : .isButton)
                    }
                    Button("Draw or import a signature…") { drawingSignature = true }.buttonHover().disabled(!session.canAddMark)
                    TextField("Name, initials or date", text: $text).textFieldStyle(.roundedBorder).onSubmit(addText)
                        .onChange(of: text) { _, typed in if typed.count > 120 { text = String(typed.prefix(120)) } }
                    Picker("Style", selection: $style) {
                        Text("Handwritten").tag(SignatureImage.TextStyle.handwritten)
                        Text("Plain").tag(SignatureImage.TextStyle.plain)
                    }
                    .pickerStyle(.segmented).labelsHidden()
                    Button(action: addText) { Label("Add this text", systemImage: "textformat") }
                        .buttonHover().disabled(!canAddText)
                    Divider()
                    Button { session.addPlacement() } label: { Label("Place on this page", systemImage: "plus") }
                        .buttonStyle(.borderedProminent).buttonHover().disabled(session.currentMark == nil)
                    Text("Click on the page to place the mark there. Drag it to move it, drag its corner to resize it.")
                        .font(.callout).foregroundStyle(.secondary)
                    Button(role: .destructive, action: session.removeSelected) { Label("Remove from the page", systemImage: "trash") }
                        .buttonHover().disabled(session.selectedID == nil)
                    Divider()
                    Text("Your original PDF stays unchanged.").font(.callout).foregroundStyle(.secondary)
                    if session.sourceWasEncrypted {
                        Label("The saved copy will not require a password.", systemImage: "lock.open")
                            .font(.callout).foregroundStyle(.secondary)
                    }
                    Button(action: session.export) {
                        Label("Save a signed copy…", systemImage: "square.and.arrow.down")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .buttonHover()
                    .disabled(!session.canExport)
                    if session.placements.isEmpty {
                        Text("Place a mark to save a signed copy.").font(.caption).foregroundStyle(.secondary)
                    }
                    if case .exporting = session.state { ProgressView("Saving signed PDF…") }
                    if let saved = session.lastSavedURL {
                        Label("Signed copy saved", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                        Text(saved.lastPathComponent).font(.callout).lineLimit(2).textSelection(.enabled)
                        Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting([saved]) }
                            .buttonHover()
                    }
                }
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: 320)
            .disabled(busy)
        }
    }

    private var canAddText: Bool { session.canAddMark && !text.trimmingCharacters(in: .whitespaces).isEmpty }

    /// The field keeps its line: the same text often goes on several pages.
    private func addText() {
        if canAddText { session.addText(text, style: style) }
    }

    private func requestOpen() {
        droppedURL = nil
        if session.hasUnexportedChanges { confirmReplacement = true } else { importingPDF = true }
    }

    private func completeOpen() {
        if let url = droppedURL { session.open(url) } else { importingPDF = true }
        droppedURL = nil
    }
}
