import PDFCore
import SwiftUI

struct PixelizeView: View {
    @Environment(PixelizeSession.self) private var session

    var body: some View {
        @Bindable var session = session
        CopyToolView(file: session.file, tool: .pixelize,
                     startTitle: "One page, one stained glass: look, don't copy",
                     startHint: "Drop a PDF here: each page becomes a picture.",
                     saveTitle: "Save the pixelized copy…", savedTitle: "Pixelized copy saved",
                     workingTitle: working, save: session.export) {
            Picker("Resolution", selection: $session.quality) {
                Text("Normal, 150 ppi").tag(PDFPageImages.Quality.normal)
                Text("High, 300 ppi").tag(PDFPageImages.Quality.high)
            }
            .pickerStyle(.radioGroup)
            Text(session.quality == .high ? "Sharper for printing, heavier file." : "Readable on screen and on paper, light file.")
                .font(.callout).foregroundStyle(.secondary)
            Text("Each page becomes a picture: the text can no longer be selected or copied.")
            Text("This is not a protection: a text recognition tool still reads a picture.").font(.callout).foregroundStyle(.secondary)
        }
    }

    private var working: LocalizedStringKey {
        if let step = session.file.step { "Page \(step.done) of \(step.total)…" } else { "Setting the glass…" }
    }
}
