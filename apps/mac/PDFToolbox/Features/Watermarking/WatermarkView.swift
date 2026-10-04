import AppKit
import PDFCore
import SwiftUI
import UniformTypeIdentifiers

struct WatermarkView: View {
    @Environment(WatermarkSession.self) private var session
    @State private var importingPDF = false
    @State private var importingImage = false
    @State private var confirmReplacement = false
    @State private var droppedURL: URL?
    @FocusState private var editingText: Bool

    private var busy: Bool { session.state == .opening || session.state == .exporting }

    var body: some View {
        VStack(spacing: 0) {
            if let error = session.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.red)
                    .font(.callout)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                Divider()
            }
            switch session.state {
            case .empty: start
            case .opening: ProgressView("Opening PDF…").frame(maxWidth: .infinity, maxHeight: .infinity)
            case .locked: PasswordPrompt(name: session.sourceName, unlock: session.unlock)
            case .ready, .exporting: workspace
            }
        }
        .navigationTitle("Add a watermark")
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
        .confirmationDialog("Discard changes to \(session.sourceName)?", isPresented: $confirmReplacement) {
            Button("Discard changes", role: .destructive) { completeOpen() }
            Button("Cancel", role: .cancel) { droppedURL = nil }
        } message: {
            Text("The watermark has not been saved. Opening another PDF will discard it.")
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
        guard !busy, !importingPDF, !importingImage, !confirmReplacement else { return ToolMenu(openTitle: "Open PDF…") }
        return ToolMenu(openTitle: "Open PDF…", open: requestOpen,
                        export: session.canExport ? { session.export() } : nil,
                        undo: session.canUndo ? { session.undo() } : nil)
    }

    private var start: some View {
        VStack(spacing: 20) {
            Image("monk-watermark").resizable().scaledToFit().frame(height: 170).accessibilityHidden(true)
            Text("Add a watermark, on your Mac").font(.brandTitle(30))
            Text("Drop a PDF here, then choose a text or an image.").foregroundStyle(.secondary)
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
                WatermarkPageView()
                Divider()
                PageStepper(index: session.pageIndex, count: session.pageSizes.count, go: session.goToPage)
            }
            .disabled(busy)
            Divider()
            ScrollView { panel.padding(24).frame(maxWidth: .infinity, alignment: .leading) }
                .frame(width: 320)
                .disabled(busy)
        }
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(session.sourceName).font(.headline).lineLimit(3).textSelection(.enabled)
            Divider()
            Picker("Watermark type", selection: kind) {
                Text("Text").tag(WatermarkSession.Kind.text)
                Text("Image").tag(WatermarkSession.Kind.image)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            if session.settings.kind == .text {
                TextField("Watermark text", text: setting(\.text, final: false))
                    .textFieldStyle(.roundedBorder)
                    .focused($editingText)
                    .onSubmit { session.update { _ in } }
                    .onChange(of: editingText) { if !editingText { session.update { _ in } } }
                    // Another watermark selected: the field must not keep the string of the one before.
                    .onChange(of: session.settings.id) { editingText = false }
                ColorPicker("Color", selection: color, supportsOpacity: false)
            } else {
                if let image = session.settings.image, let preview = NSImage(data: image.dataPNG) {
                    Image(nsImage: preview).resizable().scaledToFit().frame(maxWidth: .infinity).frame(height: 80)
                        .padding(8).background(.white, in: RoundedRectangle(cornerRadius: 8))
                }
                Button("Choose an image…", action: chooseImage).buttonHover()
            }
            LabeledContent("Opacity") { Text(session.settings.opacity, format: .percent.precision(.fractionLength(0))).monospacedDigit() }
            Slider(value: setting(\.opacity, final: false), in: Watermark.opacities) { editing in if !editing { session.update { _ in } } }
            LabeledContent("Angle") { Text("\(Int(session.settings.angle.rounded()))°").monospacedDigit() }
            Slider(value: setting(\.angle, final: false), in: Watermark.angles) { editing in if !editing { session.update { _ in } } }
            Picker("Pages", selection: setting(\.allPages)) {
                Text("All pages").tag(true)
                Text("Some pages").tag(false)
            }
            .pickerStyle(.radioGroup)
            if !session.settings.allPages {
                let count = session.pageSizes.count
                NumberField(title: "From page", value: page(\.firstPage), range: 1...count)
                NumberField(title: "to page", value: page(\.lastPage), range: 1...count)
            }
            Text("Drag the watermark to move it. Drag its corner to resize it.").font(.callout).foregroundStyle(.secondary)
            Divider()
            if session.layout.marks.count > 1 {
                Text("Watermarks on the document: \(session.layout.marks.count). Click one to edit it.").font(.callout).foregroundStyle(.secondary)
            }
            Button(action: session.addPlacement) { Label("Place another one", systemImage: "plus").frame(maxWidth: .infinity) }
                .buttonHover().disabled(!session.canAdd)
            Button(role: .destructive, action: session.removePlacement) { Label("Remove from the page", systemImage: "trash").frame(maxWidth: .infinity) }
                .buttonHover().disabled(!session.canRemove)
            Divider()
            Text("Your original PDF stays unchanged.").font(.callout).foregroundStyle(.secondary)
            if session.sourceWasEncrypted {
                Label("The saved copy will not require a password.", systemImage: "lock.open").font(.callout).foregroundStyle(.secondary)
            }
            Button(action: session.export) {
                Label("Save a watermarked copy…", systemImage: "square.and.arrow.down").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent).controlSize(.large)
            .buttonHover()
            .disabled(!session.canExport)
            if session.mark == nil {
                Text("Enter a text or choose an image to save a copy.").font(.caption).foregroundStyle(.secondary)
            }
            if case .exporting = session.state { ProgressView("Saving watermarked PDF…") }
            if let saved = session.lastSavedURL {
                Label("Watermarked copy saved", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                Text(saved.lastPathComponent).font(.callout).lineLimit(2).textSelection(.enabled)
                Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting([saved]) }.buttonHover()
            }
        }
    }

    private var kind: Binding<WatermarkSession.Kind> {
        Binding(get: { session.settings.kind }, set: { kind in
            if kind == .text { session.useText() } else if session.settings.image != nil { session.useImage() } else { chooseImage() }
        })
    }

    private var color: Binding<Color> {
        Binding(get: {
            let color = session.settings.color
            return Color(.sRGB, red: color.red, green: color.green, blue: color.blue)
        }, set: { value in
            guard let rgb = NSColor(value).usingColorSpace(.sRGB) else { return }
            session.update(final: false) {
                $0.color = WatermarkColor(red: rgb.redComponent, green: rgb.greenComponent, blue: rgb.blueComponent)
            }
        })
    }

    /// `final: false` for a field or a slider still moving: the undo step comes when it stops.
    private func setting<Value>(_ key: WritableKeyPath<WatermarkSession.Settings, Value>, final: Bool = true) -> Binding<Value> {
        Binding(get: { session.settings[keyPath: key] }, set: { value in session.update(final: final) { $0[keyPath: key] = value } })
    }

    private func page(_ key: WritableKeyPath<WatermarkSession.Settings, Int>) -> Binding<Int> {
        Binding(get: { session.settings[keyPath: key] + 1 }, set: { value in session.update { $0[keyPath: key] = value - 1 } })
    }

    private func chooseImage() {
        Task {
            importingImage = true
            defer { importingImage = false }
            if let url = await chooseFile([.png, .jpeg]) { session.importImage(url) }
        }
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
