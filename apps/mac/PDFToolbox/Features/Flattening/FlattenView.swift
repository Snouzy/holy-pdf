import SwiftUI

struct FlattenView: View {
    @Environment(FlattenSession.self) private var session

    var body: some View {
        CopyToolView(file: session.file, tool: .flatten,
                     startTitle: "One roll, and nothing moves anymore",
                     startHint: "Drop a PDF here: its filled fields and its annotations become part of the page.",
                     saveTitle: "Save the flattened copy…", savedTitle: "Flattened copy saved", save: session.export) {
            Text("The filled fields and the annotations become part of the page: they look the same and can no longer be changed.")
            Text("The text stays text, and the links stay links.").font(.callout).foregroundStyle(.secondary)
        }
    }
}
