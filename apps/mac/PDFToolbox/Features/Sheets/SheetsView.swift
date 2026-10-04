import PDFCore
import SwiftUI

struct SheetsView: View {
    @Environment(SheetsSession.self) private var session

    var body: some View {
        @Bindable var session = session
        let pages = session.file.pageSizes.count
        let (columns, rows) = PDFSheets.grid(session.perSheet) ?? (1, 1)
        CopyToolView(file: session.file, tool: .sheets,
                     startTitle: "Four pages, one sheet",
                     startHint: "Drop a PDF here, then choose how many pages go on each sheet.",
                     saveTitle: "Save the sheets…", savedTitle: "Sheets saved",
                     workingTitle: working, save: session.export) {
            Text("Pages per sheet").font(.headline)
            Picker("Pages per sheet", selection: $session.perSheet) {
                ForEach(PDFSheets.choices, id: \.self) { Text(verbatim: "\($0)").tag($0) }
            }
            .pickerStyle(.segmented).labelsHidden()
            SheetDiagram(columns: columns, rows: rows).frame(maxWidth: .infinity)
            Text(columns > rows ? "A4 sheet, landscape." : "A4 sheet, portrait.").font(.callout).foregroundStyle(.secondary)
            Text("Pages: \(pages). Sheets: \((pages + session.perSheet - 1) / session.perSheet).")
            Text("The pages follow the reading order and their text stays text. The links and the bookmarks do not follow.")
                .font(.callout).foregroundStyle(.secondary)
        }
    }

    private var working: LocalizedStringKey {
        if let step = session.file.step { "Page \(step.done) of \(step.total)…" } else { "Laying out the sheets…" }
    }
}

/// The sheet and its cells, numbered in reading order.
private struct SheetDiagram: View {
    let columns: Int
    let rows: Int

    var body: some View {
        Grid(horizontalSpacing: 0, verticalSpacing: 0) {
            ForEach(0..<rows, id: \.self) { row in
                GridRow {
                    ForEach(0..<columns, id: \.self) { column in
                        Text(verbatim: "\(row * columns + column + 1)").font(.caption).foregroundStyle(.black)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .border(Color.gray.opacity(0.5), width: 0.5)
                    }
                }
            }
        }
        .frame(width: columns > rows ? 150 : 106, height: columns > rows ? 106 : 150)
        .background(.white)
        .shadow(color: .black.opacity(0.12), radius: 3, y: 1)
        .accessibilityHidden(true)
    }
}
