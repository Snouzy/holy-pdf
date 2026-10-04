import PDFCore
import SwiftUI

struct PageNumberView: View {
    @Environment(PageNumberSession.self) private var session

    var body: some View {
        CopyToolView(file: session.file, tool: .pageNumbers,
                     startTitle: "Every page gets its number",
                     startHint: "Drop a PDF here, then choose where the numbers go.",
                     saveTitle: "Save a numbered copy…", savedTitle: "Numbered copy saved",
                     save: session.export) {
            Picker("Format", selection: setting(\.format)) {
                ForEach(PageNumbering.Format.allCases, id: \.self) { format in Text(verbatim: example(format)).tag(format) }
            }
            Picker("Position", selection: setting(\.position)) {
                ForEach(PageNumbering.Position.allCases, id: \.self) { position in Text(name(position)).tag(position) }
            }
            NumberField(title: "First number", value: setting(\.first), range: 0...99_999)
            Stepper("Size: \(Int(session.settings.fontSize)) pt", value: setting(\.fontSize), in: PageNumbering.fontSizes, step: 1)
            Picker("Pages", selection: allPages) {
                Text("All pages").tag(true)
                Text("Some pages").tag(false)
            }
            .pickerStyle(.radioGroup)
            if !session.settings.allPages, let pages = session.numbering?.pages {
                let count = session.file.pageSizes.count
                NumberField(title: "From page", value: page(\.firstPage, shown: pages.lowerBound), range: 1...count)
                NumberField(title: "to page", value: page(\.lastPage, shown: pages.upperBound), range: 1...count)
            }
        }
    }

    /// What the format writes on the first numbered page, with the settings on screen.
    private func example(_ format: PageNumbering.Format) -> String {
        guard var numbering = session.numbering else { return "" }
        numbering.format = format
        return numbering.text(forPage: numbering.pages.lowerBound) ?? ""
    }

    private func name(_ position: PageNumbering.Position) -> LocalizedStringKey {
        switch position {
        case .topLeft: "Top left"
        case .topCenter: "Top center"
        case .topRight: "Top right"
        case .bottomLeft: "Bottom left"
        case .bottomCenter: "Bottom center"
        case .bottomRight: "Bottom right"
        }
    }

    private var allPages: Binding<Bool> {
        Binding(get: { session.settings.allPages }, set: { all in
            guard all != session.settings.allPages else { return }
            session.update {
                $0.allPages = all
                // « Some pages » starts on the whole document; the session narrows the last page to the document.
                $0.firstPage = 0
                $0.lastPage = .max
            }
        })
    }

    private func setting<Value>(_ key: WritableKeyPath<PageNumberSession.Settings, Value>) -> Binding<Value> {
        Binding(get: { session.settings[keyPath: key] }, set: { value in session.update { $0[keyPath: key] = value } })
    }

    private func page(_ key: WritableKeyPath<PageNumberSession.Settings, Int>, shown: Int) -> Binding<Int> {
        Binding(get: { shown + 1 }, set: { value in session.update { $0[keyPath: key] = value - 1 } })
    }
}
