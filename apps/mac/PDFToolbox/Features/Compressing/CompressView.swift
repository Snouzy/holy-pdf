import PDFCore
import SwiftUI

struct CompressView: View {
    @Environment(CompressSession.self) private var session

    var body: some View {
        @Bindable var session = session
        CopyToolView(file: session.file, tool: .compress,
                     startTitle: "The photos slim down, the words stay",
                     startHint: "Drop a PDF here, then choose how hard to press.",
                     saveTitle: "Save the compressed copy…", savedTitle: "Compressed copy saved",
                     workingTitle: "Compressing…", canSave: session.canSave, save: session.export) {
            Picker("Compression level", selection: $session.level) {
                ForEach(CompressionLevel.allCases, id: \.self) { level in Text(name(level)).tag(level) }
            }
            .pickerStyle(.radioGroup)
            Text(note(session.level)).font(.callout).foregroundStyle(.secondary)
            Text("The text stays selectable at every level.").font(.callout).foregroundStyle(.secondary)
            let compress = Button { Task { await session.compress() } } label: {
                Label("Compress the PDF", systemImage: "arrow.down.right.and.arrow.up.left").frame(maxWidth: .infinity)
            }
            .controlSize(.large).buttonHover()
            // The blue button is the next step: compress first, save once there is a lighter copy.
            if session.canSave { compress } else { compress.buttonStyle(.borderedProminent) }
            switch session.outcome {
            case .lighter(let original, let bytes):
                // 99.6 % must not read « 100 % lighter ».
                let saved = min(Double(original - bytes) / Double(original), 0.99)
                Label("Your PDF is \(saved, format: .percent.precision(.fractionLength(0))) lighter", systemImage: "checkmark.circle.fill")
                    .font(.headline).foregroundStyle(.green)
                Text(verbatim: "\(size(original)) → \(size(bytes))").font(.callout).foregroundStyle(.secondary)
                Picker("Page shown", selection: $session.showsCopy) {
                    Text("Compressed copy").tag(true)
                    Text("Original").tag(false)
                }
                .pickerStyle(.segmented).labelsHidden()
            case .alreadyLight:
                Label("This PDF was already well pressed: no copy is lighter at this level.", systemImage: "checkmark.circle")
            case nil:
                EmptyView()
            }
        }
    }

    private func size(_ bytes: Int) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }

    private func name(_ level: CompressionLevel) -> LocalizedStringKey {
        switch level {
        case .low: "Low"
        case .recommended: "Recommended"
        case .extreme: "Extreme"
        }
    }

    private func note(_ level: CompressionLevel) -> LocalizedStringKey {
        switch level {
        case .low: "Quality better preserved. A gentler compression."
        case .recommended: "A balance between size and image quality."
        case .extreme: "A strong compression. The images lose detail."
        }
    }
}
