import AppKit
import PDFCore
import SwiftUI

struct PageImagesView: View {
    @Environment(PageImagesSession.self) private var session

    var body: some View {
        @Bindable var session = session
        CopyToolView(file: session.file, tool: .pdfToImages,
                     startTitle: "Every page, illuminated as an image",
                     startHint: "Drop a PDF here: each page becomes a JPG image.",
                     workingTitle: working, passwordNote: false, save: session.export) {
            Picker("What do you want?", selection: $session.mode) {
                Text("Pages to JPG").tag(PageImagesSession.Mode.pages)
                Text("Extract images").tag(PageImagesSession.Mode.photos)
            }
            .pickerStyle(.radioGroup).disabled(session.photoCount == 0)
            if session.mode == .pages {
                Picker("Image quality", selection: $session.quality) {
                    Text("Normal (recommended)").tag(PDFPageImages.Quality.normal)
                    Text("High (sharper)").tag(PDFPageImages.Quality.high)
                }
                .pickerStyle(.radioGroup)
                Text("High: sharper images, but heavier.").font(.callout).foregroundStyle(.secondary)
                Text("Pages: \(session.file.pageSizes.count), so as many JPG images.")
            } else {
                if let count = session.photoCount { Text("Photos in this PDF: \(count).") } else { Text("Counting the photos…") }
                Text("The text is left out: you get only the photos, as they are in the PDF.").font(.callout).foregroundStyle(.secondary)
            }
            if session.photoCount == 0 {
                Text("This PDF holds no photo: its pages become the images.").font(.callout).foregroundStyle(.secondary)
            }
            let convert = Button(action: session.export) {
                Label("Convert to JPG…", systemImage: "photo.on.rectangle").frame(maxWidth: .infinity)
            }
            .controlSize(.large).buttonHover()
            if session.savedURLs.isEmpty { convert.buttonStyle(.borderedProminent) } else { convert }
            if let folder = session.savedURLs.first?.deletingLastPathComponent() {
                Label("Images ready: \(session.savedURLs.count)", systemImage: "checkmark.circle.fill").font(.headline).foregroundStyle(.green)
                Text(folder.lastPathComponent).font(.callout).lineLimit(2).textSelection(.enabled)
                Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting(session.savedURLs) }.buttonHover()
            }
        }
    }

    private var working: LocalizedStringKey {
        if let step = session.file.step { "Page \(step.done) of \(step.total)…" } else { "Illuminating…" }
    }
}
