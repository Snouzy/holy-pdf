import PDFCore
import SwiftUI

struct OverlayView: View {
    @Environment(OverlaySession.self) private var session

    var body: some View {
        @Bindable var session = session
        CopyToolView(file: session.file, tool: .overlay,
                     startTitle: "Two PDFs, one page",
                     startHint: "Drop the PDF that receives the other one: a letter for your letterhead, for instance.",
                     saveTitle: "Save the overlaid copy…", savedTitle: "Overlaid copy saved",
                     workingTitle: "Laying the pages…", canSave: session.layer != nil, save: session.export) {
            let choose = Button(action: session.chooseLayer) {
                Label(session.layer == nil ? "Choose the PDF to lay on it…" : "Choose another PDF…", systemImage: "square.on.square")
                    .frame(maxWidth: .infinity)
            }
            .controlSize(.large).buttonHover()
            // The blue button is the next step: choose first, save once there is something to lay.
            if session.layer == nil { choose.buttonStyle(.borderedProminent) } else { choose }
            if let layer = session.layer {
                Text(layer.name).font(.headline).lineLimit(2)
                Text("Pages: \(layer.pages)").font(.callout).foregroundStyle(.secondary)
            }
            Picker("Position", selection: $session.position) {
                Text("Over the pages").tag(PDFOverlay.Position.over)
                Text("Under the pages").tag(PDFOverlay.Position.under)
            }
            .pickerStyle(.radioGroup)
            Text(session.position == .over ? "It covers the page wherever it is not transparent." : "It shows wherever the page left the paper bare.")
                .font(.callout).foregroundStyle(.secondary)
            Text("Its page 1 goes on page 1, its page 2 on page 2, and so on. Its last page goes on all the pages that remain.")
                .font(.callout).foregroundStyle(.secondary)
        }
    }
}
