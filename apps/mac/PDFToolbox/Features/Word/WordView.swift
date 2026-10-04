import AppKit
import SwiftUI

struct WordView: View {
    @Environment(WordSession.self) private var session

    var body: some View {
        CopyToolView(file: session.file, tool: .pdfToWord,
                     startTitle: "I copy, you correct",
                     startHint: "Drop a PDF here: its text and its pictures go into a Word document.",
                     workingTitle: working, passwordNote: false, save: session.export) {
            Text("The monk copies the text, its size and its style, paragraph by paragraph, and the pictures where they stand.")
            Text("Tables become lines of text, and columns follow one another. A scan that was not read gives only its picture.")
                .font(.callout).foregroundStyle(.secondary)
            let convert = Button(action: session.export) {
                Label("Convert to Word…", systemImage: "doc.richtext").frame(maxWidth: .infinity)
            }
            .controlSize(.large).buttonHover()
            if session.savedURL == nil { convert.buttonStyle(.borderedProminent) } else { convert }
            if let saved = session.savedURL {
                Label("Your PDF is in Word", systemImage: "checkmark.circle.fill").font(.headline).foregroundStyle(.green)
                Text(saved.lastPathComponent).font(.callout).lineLimit(2).textSelection(.enabled)
                Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting([saved]) }.buttonHover()
            }
        }
    }

    private var working: LocalizedStringKey {
        if let step = session.file.step { "Page \(step.done) of \(step.total)…" } else { "Copying the pages…" }
    }
}
