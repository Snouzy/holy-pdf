import AppKit
import SwiftUI
import UniformTypeIdentifiers

struct ImagesView: View {
    @Environment(ImagesSession.self) private var session
    @State private var importing = false
    @State private var confirmClear = false

    var body: some View {
        VStack(spacing: 0) {
            if let error = session.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.red).font(.callout).padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                Divider()
            }
            if session.items.isEmpty { start } else { workspace }
        }
        .navigationTitle(Tool.imagesToPDF.title)
        .toolbar {
            ToolbarItemGroup {
                Button { importing = true } label: { Label("Add images…", systemImage: "photo.badge.plus") }
                    .buttonHover().disabled(session.isBusy)
            }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.image], allowsMultipleSelection: true) { result in
            if case .success(let urls) = result { Task { await session.add(urls) } }
        }
        .dropDestination(for: URL.self) { urls, _ in
            guard !session.isBusy, !urls.isEmpty else { return false }
            Task { await session.add(urls) }
            return true
        }
        .confirmationDialog("Remove all the images?", isPresented: $confirmClear) {
            Button("Remove all the images", role: .destructive, action: session.removeAll)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The PDF of this list has not been saved.")
        }
        .focusedSceneValue(\.toolMenu, menu)
    }

    private var menu: ToolMenu {
        guard !session.isBusy, !importing, !confirmClear else { return ToolMenu(openTitle: "Add images…") }
        let export: (() -> Void)? = session.canSave ? { session.export() } : nil
        return ToolMenu(openTitle: "Add images…", open: { importing = true }, export: export)
    }

    private var start: some View {
        VStack(spacing: 20) {
            Image(Tool.imagesToPDF.imageName).resizable().scaledToFit().frame(height: 170).accessibilityHidden(true)
            Text("Your photos, bound like a missal").font(.brandTitle(30))
            Text("Drop images here, then drag them into the order you want.").foregroundStyle(.secondary)
            if session.isBusy {
                ProgressView()
            } else {
                Button("Choose images…") { importing = true }.buttonStyle(.borderedProminent).controlSize(.large).buttonHover()
            }
            Text("Your documents stay on this Mac.").font(.callout).foregroundStyle(.secondary)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func row(_ item: ImagesSession.Item, number: Int) -> some View {
        let weight = ByteCountFormatter.string(fromByteCount: Int64(item.data.count), countStyle: .file)
        return HStack(spacing: 12) {
            Text(verbatim: "\(number)").monospacedDigit().foregroundStyle(.secondary).frame(width: 28, alignment: .trailing)
            Image(decorative: item.thumbnail, scale: 1).resizable().scaledToFit().frame(width: 56, height: 56)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: item.name).lineLimit(1)
                Text(verbatim: "\(Int(item.pixels.width)) × \(Int(item.pixels.height)) · \(weight)").font(.callout).foregroundStyle(.secondary)
            }
            Spacer()
            Button { session.move(item.id, by: -1) } label: { Image(systemName: "chevron.up") }
                .buttonStyle(.borderless).help("Move up").disabled(number == 1)
            Button { session.move(item.id, by: 1) } label: { Image(systemName: "chevron.down") }
                .buttonStyle(.borderless).help("Move down").disabled(number == session.items.count)
            Button { session.remove(item.id) } label: { Image(systemName: "xmark.circle") }
                .buttonStyle(.borderless).help("Remove this image")
        }
        .padding(.vertical, 4)
    }

    private var workspace: some View {
        HStack(spacing: 0) {
            List {
                ForEach(Array(session.items.enumerated()), id: \.element.id) { index, item in
                    row(item, number: index + 1)
                }
                .onMove(perform: session.move)
            }
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Images: \(session.items.count)").font(.headline)
                    Divider()
                    Text("Each image takes one A4 page, turned to its shape. Drag the rows, or use their arrows, to set the order of the pages.")
                    Button { importing = true } label: { Label("Add images…", systemImage: "photo.badge.plus") }.buttonHover()
                    Button("Remove all the images") {
                        if session.hasUnsavedChanges { confirmClear = true } else { session.removeAll() }
                    }
                    .buttonHover()
                    Divider()
                    Text("Your images stay unchanged.").font(.callout).foregroundStyle(.secondary)
                    Button(action: session.export) { Label("Create the PDF…", systemImage: "square.and.arrow.down").frame(maxWidth: .infinity) }
                        .buttonStyle(.borderedProminent).controlSize(.large).buttonHover()
                    if session.isBusy { ProgressView("Making the PDF…") }
                    if let saved = session.lastSavedURL {
                        Label("Your PDF is ready", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                        Text(saved.lastPathComponent).font(.callout).lineLimit(2).textSelection(.enabled)
                        Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting([saved]) }.buttonHover()
                    }
                }
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: 320)
        }
        .disabled(session.isBusy)
    }
}
