import PDFCore
import SwiftUI

struct EditView: View {
    @Environment(EditSession.self) private var session

    var body: some View {
        CopyToolView(file: session.file, tool: .edit,
                     startTitle: "Edit your PDF, on your Mac",
                     startHint: "Drop a PDF here, then add text, images, shapes or highlighter.",
                     saveTitle: "Save a copy…", savedTitle: "Edited copy saved",
                     canSave: session.canSave,
                     undo: session.canUndo ? { session.undo() } : nil,
                     redo: session.canRedo ? { session.redo() } : nil,
                     onPage: AnyView(EditCanvas(session: session)), save: session.export) {
            EditPanel(session: session)
        }
    }
}

private struct EditPanel: View {
    let session: EditSession

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Tools").font(.headline)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 5), spacing: 6) {
                ToolButton(title: "Select", symbol: "cursorarrow", active: session.tool == .select) { session.choose(.select) }
                ToolButton(title: "Text", symbol: "textformat", active: session.tool == .text) { session.choose(.text) }
                ToolButton(title: "Image", symbol: "photo", active: false, action: session.chooseImage)
                ToolButton(title: "Rectangle", symbol: "rectangle", active: session.tool == .rectangle) { session.choose(.rectangle) }
                ToolButton(title: "Ellipse", symbol: "circle", active: session.tool == .ellipse) { session.choose(.ellipse) }
                ToolButton(title: "Line", symbol: "line.diagonal", active: session.tool == .line) { session.choose(.line) }
                ToolButton(title: "Arrow", symbol: "arrow.up.right", active: session.tool == .arrow) { session.choose(.arrow) }
                ToolButton(title: "Pen", symbol: "pencil.tip", active: session.tool == .pen) { session.choose(.pen) }
                ToolButton(title: "Highlighter", symbol: "highlighter", active: session.tool == .highlighter) { session.choose(.highlighter) }
            }
            if session.tool == .select {
                Text("Click an addition to move it, resize it or change its style.").font(.callout).foregroundStyle(.secondary)
            } else {
                Text("Pick a tool, then click or drag on the page.").font(.callout).foregroundStyle(.secondary)
            }
            if session.isLoadingImage { ProgressView("Opening the image…").controlSize(.small) }
            switch session.styleKind {
            case .text?: textControls
            case .shape?: shapeControls
            case .stroke?:
                thickness
                colors
            case .highlight?: colors
            case .picture?: pictureControls
            case nil: EmptyView()
            }
            if session.selected != nil { orderControls }
        }
    }

    private var textControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Font", selection: binding(\.font)) {
                Text(verbatim: "Helvetica").tag(EditFont.helvetica)
                Text(verbatim: "Times").tag(EditFont.times)
                Text(verbatim: "Courier").tag(EditFont.courier)
            }
            Toggle("Bold", isOn: binding(\.bold))
            Stepper(value: binding(\.size), in: EditTextStyle.sizes, step: 1) { Text("Size: \(Int(session.style.size)) pt") }
            colors
            Text("Return starts a new line. Double-click a text to change it.").font(.callout).foregroundStyle(.secondary)
        }
    }

    private var shapeControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Shape", selection: binding(\.fill)) {
                Text("Outline").tag(false)
                Text("Filled").tag(true)
            }
            .pickerStyle(.segmented).labelsHidden()
            if !session.style.fill { thickness }
            colors
        }
    }

    private var thickness: some View {
        Picker("Thickness", selection: binding(\.thickness)) {
            Text("Thin").tag(EditThickness.thin)
            Text("Medium").tag(EditThickness.medium)
            Text("Thick").tag(EditThickness.thick)
        }
        .pickerStyle(.segmented)
    }

    private var colors: some View {
        HStack(spacing: 6) {
            ForEach(EditColor.allCases, id: \.self) { color in
                Button { session.restyle { $0.color = color } } label: {
                    Circle().fill(Color(cgColor: color.cgColor)).frame(width: 22, height: 22)
                        .overlay(Circle().strokeBorder(Color(nsColor: .separatorColor)))
                        .padding(3)
                        .overlay(Circle().strokeBorder(session.style.color == color ? Color.accentColor : .clear, lineWidth: 2))
                }
                .buttonStyle(.plain).help(color.title).accessibilityLabel(color.title).buttonHover()
            }
        }
    }

    private var pictureControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button(action: session.toggleCropping) {
                if session.isCropping { Label("Done cropping", systemImage: "checkmark") } else { Label("Crop", systemImage: "crop") }
            }
            .buttonHover()
            if session.isCropping {
                Text("Drag the corners to keep only part of the image.").font(.callout).foregroundStyle(.secondary)
            }
            Button(action: session.turnSelected) { Label("Turn right", systemImage: "rotate.right") }.buttonHover()
            Button { session.flipSelected(horizontally: true) } label: {
                Label("Flip horizontally", systemImage: "arrow.left.and.right.righttriangle.left.righttriangle.right")
            }
            .buttonHover()
            Button { session.flipSelected(horizontally: false) } label: {
                Label("Flip vertically", systemImage: "arrow.up.and.down.righttriangle.up.righttriangle.down")
            }
            .buttonHover()
        }
    }

    private var orderControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider()
            Button { session.moveSelected(toFront: true) } label: { Label("Bring to front", systemImage: "square.3.layers.3d.top.filled") }.buttonHover()
            Button { session.moveSelected(toFront: false) } label: { Label("Send to back", systemImage: "square.3.layers.3d.bottom.filled") }.buttonHover()
            Button(role: .destructive, action: session.deleteSelected) { Label("Delete", systemImage: "trash") }.buttonHover()
        }
    }

    private func binding<Value>(_ path: WritableKeyPath<EditStyle, Value>) -> Binding<Value> {
        Binding(get: { session.style[keyPath: path] }, set: { value in session.restyle { $0[keyPath: path] = value } })
    }
}

private struct ToolButton: View {
    let title: LocalizedStringKey
    let symbol: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 15)).frame(maxWidth: .infinity, minHeight: 32)
        }
        .buttonStyle(.plain)
        .foregroundStyle(active ? Color.accentColor : .primary)
        .background(active ? Color.accentColor.opacity(0.18) : Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).strokeBorder(active ? Color.accentColor : Color(nsColor: .separatorColor)))
        .help(title)
        .accessibilityLabel(title)
        .buttonHover()
    }
}

private extension EditColor {
    var title: LocalizedStringKey {
        switch self {
        case .black: "Black"
        case .blue: "Blue"
        case .red: "Red"
        case .green: "Green"
        case .yellow: "Yellow"
        case .white: "White"
        }
    }
}
