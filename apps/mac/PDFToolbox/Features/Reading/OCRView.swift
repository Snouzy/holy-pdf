import ScanCore
import SwiftUI

struct OCRView: View {
    @Environment(OCRSession.self) private var session
    @Environment(\.locale) private var locale

    var body: some View {
        @Bindable var session = session
        CopyToolView(file: session.file, tool: .ocr,
                     startTitle: "Your scans find their words again",
                     startHint: "Drop a scanned PDF here, then let the monk read it.",
                     saveTitle: "Save the copy with its text…", savedTitle: "Copy with its text saved",
                     workingTitle: working, canSave: session.canSave, save: session.export) {
            Text("The monk reads the pages that have no text and lays what he reads over them, invisible. You can then search the PDF and copy its text.")
            Text("The pages that already have their text stay as they are.").font(.callout).foregroundStyle(.secondary)
            Picker("Language of the text", selection: $session.language) {
                Text(verbatim: usual).tag(String?.none)
                Divider()
                ForEach(choices, id: \.code) { choice in Text(verbatim: choice.name).tag(String?.some(choice.code)) }
            }
            let read = Button { Task { await session.read() } } label: {
                Label("Read the text", systemImage: "text.viewfinder").frame(maxWidth: .infinity)
            }
            .controlSize(.large).buttonHover()
            if session.canSave { read } else { read.buttonStyle(.borderedProminent) }
            switch session.outcome {
            case .added(let pages):
                Label("Text added to \(pages) pages", systemImage: "checkmark.circle.fill").font(.headline).foregroundStyle(.green)
                Text("The lines read are highlighted on the page.").font(.callout).foregroundStyle(.secondary)
            case .nothing:
                Label("No text to add: these pages already have their text, or show none.", systemImage: "checkmark.circle")
            case nil:
                EmptyView()
            }
        }
    }

    private var working: LocalizedStringKey {
        if let step = session.file.step { "Reading page \(step.done) of \(step.total)…" } else { "Reading the text…" }
    }

    /// What this Mac reads, by name. Vision lists a code that has no name (« vi-VT »): the name of its language stands in.
    private var choices: [(code: String, name: String)] {
        TextReader.supported.map { code in
            (code, locale.localizedString(forIdentifier: code) ?? locale.localizedString(forLanguageCode: String(code.prefix { $0 != "-" })) ?? code)
        }
        .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    /// The three languages of the Scanner, read together.
    private var usual: String {
        TextReader.languages.compactMap { locale.localizedString(forLanguageCode: String($0.prefix(2))) }.formatted(.list(type: .and).locale(locale))
    }
}
