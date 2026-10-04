import PDFCore
import SwiftUI

struct HalvesView: View {
    @Environment(HalvesSession.self) private var session

    var body: some View {
        @Bindable var session = session
        let pages = session.file.pageSizes.count
        CopyToolView(file: session.file, tool: .halves,
                     startTitle: "One cut, two pages",
                     startHint: "Drop a PDF here, then choose the direction of the cut.",
                     saveTitle: "Save the cut copy…", savedTitle: "Cut copy saved",
                     workingTitle: "Cutting…", save: session.export) {
            Picker("Direction of the cut", selection: $session.cut) {
                Text("Left | right").tag(PDFPageHalves.Cut.leftRight)
                Text("Top | bottom").tag(PDFPageHalves.Cut.topBottom)
            }
            .pickerStyle(.radioGroup)
            Text(session.cut == .leftRight ? "For a scanned open book: each page on its own." : "For a sheet folded in two across its height.")
                .font(.callout).foregroundStyle(.secondary)
            Text("Pages: \(pages). After the cut: \(pages * 2).")
            Text("The text stays text. A link or a field stays on the half that shows it.").font(.callout).foregroundStyle(.secondary)
        }
    }
}
