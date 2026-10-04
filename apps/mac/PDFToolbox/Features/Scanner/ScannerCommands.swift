import SwiftUI

/// What the File menu can ask of the scanner on screen.
struct ScannerMenu {
    var addPhotos: () -> Void
    /// Nil while the export button is disabled.
    var export: (() -> Void)?
}

/// What the File and Edit menus can ask of the PDF tool on screen. A nil action disables its item.
struct ToolMenu {
    var openTitle: LocalizedStringKey
    var open: (() -> Void)?
    var export: (() -> Void)?
    var undo: (() -> Void)?
    var redo: (() -> Void)?
}

extension FocusedValues {
    @Entry var scannerMenu: ScannerMenu?
    @Entry var toolMenu: ToolMenu?
}

struct ScannerCommands: Commands {
    @FocusedValue(\.scannerMenu) private var scanner
    @FocusedValue(\.toolMenu) private var tool
    @AppStorage(TipsBanner.dismissedKey) private var tipsDismissed = false

    var body: some Commands {
        CommandGroup(after: .newItem) {
            if let tool {
                Button(tool.openTitle) { tool.open?() }
                    .keyboardShortcut("o")
                    .disabled(tool.open == nil)
            } else {
                Button("Add Photos…") { scanner?.addPhotos() }
                    .keyboardShortcut("o")
                    .disabled(scanner == nil)
            }
            Button("Export…") { if let tool { tool.export?() } else { scanner?.export?() } }
                .keyboardShortcut("e")
                .disabled(tool?.export == nil && scanner?.export == nil)
        }
        if let tool {
            CommandGroup(replacing: .undoRedo) {
                Button("Undo", action: { tool.undo?() })
                    .keyboardShortcut("z")
                    .disabled(tool.undo == nil)
                Button("Redo", action: { tool.redo?() })
                    .keyboardShortcut("z", modifiers: [.command, .shift])
                    .disabled(tool.redo == nil)
            }
        }
        CommandGroup(after: .help) {
            Button("Show Tips") { tipsDismissed = false }
                .disabled(!tipsDismissed)
        }
    }
}
