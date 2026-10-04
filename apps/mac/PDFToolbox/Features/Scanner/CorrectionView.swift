import ImageIO
import ScanCore
import ScanSession
import SwiftUI

enum CorrectionTool: Hashable {
    case corners, eraser
}

/// The decoded render on screen, with the geometry it was made for.
struct ShownResult {
    var pageID: UUID
    var quad: Quad
    var quarterTurns: Int
    var image: CGImage
}

struct CorrectionView: View {
    @Environment(ScannerSession.self) private var session
    @Environment(\.undoManager) private var undoManager
    let pageID: UUID
    let reviewOnly: Bool
    @Binding var toast: Toast?
    /// Opens a page, or the board with nil.
    var go: (UUID?) -> Void
    @State private var tool = CorrectionTool.corners
    @State private var brush = 30.0
    @State private var photo: Result<CGImage, ScanError>?
    @State private var result: ShownResult?
    @State private var refusal: UUID?

    var body: some View {
        if let page = session.pages[pageID] {
            content(page)
        } else {
            ContentUnavailableView("This page was deleted", systemImage: "doc")
        }
    }

    func content(_ page: ScanPage) -> some View {
        let rendered = page.status.result?.processed
        return VStack(spacing: 0) {
            HStack(spacing: 0) {
                pane("Photo · drag the corners") {
                    VStack(spacing: 8) {
                        if let rendered, case .success(let photo) = photo {
                            CornerEditor(photo: photo, quad: page.edits.quad ?? rendered.detection.quad) { quad in
                                if !session.setQuad(quad, for: pageID, undoManager: undoManager) { refusal = UUID() }
                            }
                        } else if case .failure(let error) = photo {
                            Text(ScannerText.message(for: error))
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                        } else {
                            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                        refusalMessage
                    }
                }
                Divider()
                pane(tool == .eraser ? "Result · erase what is left around the page" : "Result · choose Eraser to erase around the page",
                     busy: !page.status.isSettled) {
                    if let result, let rendered {
                        let current = showsCurrentGeometry(page, rendered, result)
                        let waiting = tool == .eraser && !current && !page.status.isSettled
                        let failed = if tool == .eraser, !current, case .failed = page.status { true } else { false }
                        ResultView(image: result.image, erasing: tool == .eraser && current, brush: brush) { mark in
                            session.addErase(mark, to: pageID, undoManager: undoManager)
                        }
                        .overlay {
                            ZStack {
                                if failed {
                                    badge("The page could not be updated.") {
                                        Image(systemName: "exclamationmark.octagon.fill").foregroundStyle(.red)
                                    }
                                    .transition(.opacity)
                                } else if waiting {
                                    badge("Updating the page…") { ProgressView().controlSize(.small) }
                                        .transition(.opacity)
                                }
                            }
                            .animation(.easeOut(duration: 0.15), value: waiting)
                            .animation(.easeOut(duration: 0.15), value: failed)
                        }
                    } else {
                        ProgressView()
                    }
                }
                // Over the result, so a toast never hides a corner or the refused-corners line.
                .toast($toast)
            }
            Divider()
            settingsBar(page, rendered: rendered)
        }
        .navigationTitle(title(page))
        .toolbar { toolbar(page) }
        .task(id: pageID) {
            session.markChecked(pageID)
            photo = nil
            refusal = nil
            let url = page.url
            let loaded = await Task.detached { () -> Result<CGImage, ScanError> in
                Result { () throws(ScanError) -> CGImage in try ImageLoader.load(url, maxLongSide: 2048).image }
            }.value
            guard !Task.isCancelled else { return }
            photo = loaded
        }
        .task(id: rendered?.jpeg) {
            guard let rendered else { return }
            let jpeg = rendered.jpeg
            let image = await Task.detached { Self.decode(jpeg) }.value
            guard !Task.isCancelled, let image else { return }
            result = ShownResult(pageID: pageID, quad: rendered.quad, quarterTurns: rendered.quarterTurns, image: image)
        }
        .task(id: refusal) {
            guard refusal != nil else { return }
            AccessibilityNotification.Announcement(String(localized: Self.refusedCorners)).post()
            try? await Task.sleep(for: .seconds(3))
            if !Task.isCancelled { refusal = nil }
        }
        // Covers Restore Automatic Detection, Undo and Redo from the toolbar and the Edit menu, and a good move.
        .onChange(of: page.edits.quad) { refusal = nil }
    }

    static let refusedCorners: LocalizedStringResource = "These corners do not make a page: keep the four corners in order around the page."

    var refusalMessage: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
            Text(Self.refusedCorners)
                .lineLimit(2, reservesSpace: true)
        }
        .font(.callout)
        .frame(maxWidth: .infinity)
        .opacity(refusal == nil ? 0 : 1)
        .accessibilityHidden(refusal == nil)
        .animation(.easeOut(duration: 0.2), value: refusal == nil)
    }

    func badge(_ text: LocalizedStringKey, @ViewBuilder icon: () -> some View) -> some View {
        HStack(spacing: 8) {
            icon()
            Text(text)
        }
        .font(.callout)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(.separator))
        .allowsHitTesting(false)
    }

    func pane(_ title: LocalizedStringKey, busy: Bool = false, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
                if busy { ProgressView().controlSize(.mini) }
            }
            content().frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(16)
    }

    @ToolbarContentBuilder
    func toolbar(_ page: ScanPage) -> some ToolbarContent {
        ToolbarItemGroup {
            Picker("Tool", selection: $tool) {
                Text("Corners").tag(CorrectionTool.corners)
                Text("Eraser").tag(CorrectionTool.eraser)
            }
            .pickerStyle(.segmented)
            // Disabled rather than hidden: an item that appears shifts the picker under the pointer.
            Slider(value: $brush, in: 4...80) {
                Text("Eraser size")
            } minimumValueLabel: {
                Image(systemName: "circle.fill").imageScale(.small).accessibilityHidden(true)
            } maximumValueLabel: {
                Image(systemName: "circle.fill").imageScale(.large).accessibilityHidden(true)
            }
            .frame(width: 140)
            .disabled(tool != .eraser)
            .help("Eraser size")
            Button("Rotate", systemImage: "rotate.right") { session.rotate(pageID, undoManager: undoManager) }
                .help("Rotate a quarter turn")
                .buttonHover()
            // Foundation localizes the Edit menu's titles: « Annuler Déplacer les coins », or « Annuler » alone.
            Button("Undo", systemImage: "arrow.uturn.backward") { undoManager?.undo() }
                .help(undoManager?.undoMenuItemTitle ?? "")
                .buttonHover()
            Button("Redo", systemImage: "arrow.uturn.forward") { undoManager?.redo() }
                .help(undoManager?.redoMenuItemTitle ?? "")
                .buttonHover()
            let document = session.document(containing: pageID)
            Button("Download…", systemImage: "arrow.down.circle") {
                if let document { SaveDocument.run(document.id, session: session, toast: $toast) }
            }
            .help("Download this document as a PDF…")
            .buttonHover()
            .disabled(document == nil)
            let next = session.page(after: pageID, reviewOnly: reviewOnly)
            Button { go(next) } label: {
                // One width for both titles, so the toolbar does not shift under the pointer on the last page.
                ZStack {
                    Text("Next Page").hidden()
                    Text("Done").hidden()
                    Text(next == nil ? "Done" : "Next Page")
                }
            }
            .buttonStyle(.borderedProminent)
            .buttonHover()
        }
    }

    func settingsBar(_ page: ScanPage, rendered: ProcessedPage?) -> some View {
        let line = status(page, rendered: rendered)
        return HStack(spacing: 14) {
            HStack(spacing: 5) {
                if case .failed = page.status {
                    Image(systemName: "exclamationmark.octagon.fill")
                        .foregroundStyle(.red)
                        .accessibilityLabel("Render failed")
                } else if line.marked {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                        .accessibilityLabel("To check")
                }
                Text(line.text)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .font(.caption)
            .help(line.text)
            .accessibilityElement(children: .combine)
            .accessibilityHidden(line.text.isEmpty)
            if page.edits.quad != nil {
                Button("Restore Automatic Detection") { session.setQuad(nil, for: pageID, undoManager: undoManager) }
                    .buttonStyle(.link)
                    .font(.caption)
                    .buttonHover()
            }
            Spacer()
            if let rendered {
                let mode = page.edits.mode ?? rendered.settings.mode
                Picker("Rendering", selection: Binding(get: { mode },
                                                       set: { session.setMode($0, for: pageID, undoManager: undoManager) })) {
                    Text("Document").tag(RenderMode.document)
                    Text("Color").tag(RenderMode.color)
                }
                .pickerStyle(.segmented)
                .fixedSize()
                if mode == .document {
                    Toggle("Keep watermark", isOn: Binding(get: { page.edits.keepWatermark ?? rendered.settings.keepWatermark },
                                                           set: { session.setKeepWatermark($0, for: pageID, undoManager: undoManager) }))
                }
                Picker("Format", selection: Binding(get: { page.edits.format },
                                                    set: { session.setFormat($0, for: pageID, undoManager: undoManager) })) {
                    Text("Auto").tag(PageFormat.auto)
                    Text(verbatim: "A4").tag(PageFormat.a4)
                    Text(verbatim: "A5").tag(PageFormat.a5)
                    Text("Letter").tag(PageFormat.letter)
                }
                .fixedSize()
            }
        }
        .controlSize(.small)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.bar)
    }

    func title(_ page: ScanPage) -> String {
        guard let document = session.document(containing: pageID), let index = document.pageIDs.firstIndex(of: pageID) else {
            return page.url.lastPathComponent
        }
        return String(localized: "\(document.name) · page \(index + 1) / \(document.pageIDs.count)")
    }

    /// `marked` cannot use `needsReview`, which opening the page cleared. The detection's reasons are about the corners.
    func status(_ page: ScanPage, rendered: ProcessedPage?) -> (text: String, marked: Bool) {
        if case .failed(let error, _) = page.status { return (ScannerText.message(for: error), false) }
        guard let rendered else { return ("", false) }
        let byHand = page.edits.quad != nil
        var reasons = byHand ? [] : rendered.detection.reviewReasons.map(ScannerText.message(for:))
        if rendered.textUnread { reasons.append(ScannerText.textUnread) }
        let lines = (byHand ? [String(localized: "Corners set by hand.")] : []) + reasons
        return (lines.joined(separator: " "), !reasons.isEmpty)
    }

    nonisolated static func decode(_ jpeg: Data) -> CGImage? {
        CGImageSourceCreateWithData(jpeg as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary) }
    }

    /// A stroke is stored in the page as it is now: while a corner move or a turn renders, the image on screen is out of date.
    func showsCurrentGeometry(_ page: ScanPage, _ rendered: ProcessedPage, _ shown: ShownResult) -> Bool {
        shown.pageID == page.id
            && shown.quad == (page.edits.quad ?? rendered.detection.quad)
            && shown.quarterTurns == (page.edits.quarterTurns ?? rendered.quarterTurns)
    }
}
