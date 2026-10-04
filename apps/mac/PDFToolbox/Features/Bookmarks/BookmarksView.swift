import SwiftUI

struct BookmarksView: View {
    @Environment(BookmarksSession.self) private var session
    @State private var title = ""

    var body: some View {
        CopyToolView(file: session.file, tool: .bookmarks,
                     startTitle: "A ribbon on every chapter",
                     startHint: "Drop a PDF here, then mark the pages you want to find again.",
                     saveTitle: "Save the copy with bookmarks…", savedTitle: "Copy with bookmarks saved",
                     workingTitle: "Writing the bookmarks…", canSave: session.canSave, save: session.export) {
            TextField("Title of the bookmark", text: $title).textFieldStyle(.roundedBorder).onSubmit(add)
            Button(action: add) {
                Label("Add a bookmark to page \(session.file.pageIndex + 1)", systemImage: "bookmark").frame(maxWidth: .infinity)
            }
            .buttonHover()
            Text("Show a page with the arrows under the preview, then add its bookmark.").font(.callout).foregroundStyle(.secondary)
            Divider()
            Text("Bookmarks: \(session.rows.count)").font(.headline)
            if session.rows.isEmpty {
                Text("This PDF has no bookmark yet.").font(.callout).foregroundStyle(.secondary)
            }
            if session.unlisted > 0 {
                Label("Bookmarks that lead to no page of this PDF: \(session.unlisted). The copy does not keep them.", systemImage: "info.circle")
                    .font(.callout).foregroundStyle(.secondary)
            }
            LazyVStack(alignment: .leading, spacing: 8) {
                ForEach(session.rows) { row in
                    HStack(spacing: 6) {
                        TextField("Title of the bookmark", text: Binding(get: { row.bookmark.title }, set: { session.rename(row.id, to: $0) }))
                            .textFieldStyle(.roundedBorder)
                        Button { session.file.goToPage(row.bookmark.pageIndex) } label: {
                            Text("p. \(row.bookmark.pageIndex + 1)").monospacedDigit()
                        }
                        .buttonStyle(.link).help("Show this page")
                        Button { session.remove(row.id) } label: {
                            Label("Remove this bookmark", systemImage: "trash").labelStyle(.iconOnly)
                        }
                        .buttonStyle(.borderless).buttonHover()
                    }
                    .padding(.leading, CGFloat(row.bookmark.level) * 14)
                    .contextMenu {
                        Button("Put under the bookmark above") { session.shift(row.id, by: 1) }
                        Button("Move up one level") { session.shift(row.id, by: -1) }
                    }
                }
            }
        }
    }

    private func add() {
        session.add(title: title)
        title = ""
    }
}
