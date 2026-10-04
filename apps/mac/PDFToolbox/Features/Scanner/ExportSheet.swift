import AppKit
import ScanSession
import SwiftUI

struct ExportSheet: View {
    @Environment(ScannerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Binding var folder: URL?
    /// Closes the sheet and opens a page to check.
    var review: (UUID) -> Void
    @State private var excluded: Set<UUID> = []
    @State private var searchableText = true
    @State private var revealAfter = true
    @State private var choosingFolder = false
    @State private var conflicts: [String] = []
    @State private var running = false
    @State private var failures: [String] = []

    var body: some View {
        let items = session.exportItems
        VStack(alignment: .leading, spacing: 18) {
            Text("Export \(chosen.count) documents")
                .font(.brandTitle(26))
            List(items) { item in
                Toggle(isOn: binding(for: item.id)) {
                    HStack {
                        if item.failedPages > 0 {
                            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                                .help(String(localized: "A page could not be rendered again: the PDF keeps its last good render."))
                        }
                        Text(item.fileName).lineLimit(1).truncationMode(.middle)
                        Spacer()
                        Text("\(item.pageCount) p.").foregroundStyle(.secondary).frame(width: 60, alignment: .trailing)
                        Text(item.bytes.formatted(.byteCount(style: .file))).foregroundStyle(.secondary).frame(width: 70, alignment: .trailing)
                    }
                }
                .toggleStyle(.checkbox)
            }
            .frame(height: 220)
            let toCheck = session.pagesToReview
            if let first = toCheck.first {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                    Text("\(toCheck.count) pages still need checking.")
                    Spacer()
                    Button("Review") { review(first) }
                        .buttonHover()
                        .disabled(running)
                }
                .font(.callout)
            }
            HStack(spacing: 10) {
                Text("Folder").foregroundStyle(.secondary).frame(width: 90, alignment: .leading)
                Text(folder?.lastPathComponent ?? String(localized: "No folder chosen"))
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
                Button("Choose…") { choosingFolder = true }
                    .buttonHover()
            }
            VStack(alignment: .leading, spacing: 10) {
                Toggle(isOn: $searchableText) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Searchable text (OCR)")
                        Text("Search and copy the text in Preview, Mail and Spotlight.").font(.caption).foregroundStyle(.secondary)
                    }
                }
                Toggle("Open the folder after the export", isOn: $revealAfter)
                Text("200 dpi, real page format (A4, A5). The GPS position of the photos is never copied into the PDFs.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .toggleStyle(.checkbox)
            ForEach(failures, id: \.self) { failure in
                Text(failure).font(.callout).foregroundStyle(.red)
            }
            HStack {
                Spacer()
                if running { ProgressView().controlSize(.small) }
                Button("Cancel", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
                    .buttonHover()
                    .disabled(running)
                Button("Export") { start() }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
                    .buttonHover()
                    .disabled(folder == nil || chosen.isEmpty || running)
            }
        }
        .padding(24)
        .frame(width: 620)
        .interactiveDismissDisabled(running)
        .fileImporter(isPresented: $choosingFolder, allowedContentTypes: [.folder]) { result in
            if case .success(let url) = result { folder = url; failures = [] }
        }
        .confirmationDialog(String(localized: "\(conflicts.count) PDF already exist in this folder"),
                            isPresented: Binding(get: { !conflicts.isEmpty }, set: { if !$0 { conflicts = [] } })) {
            Button("Replace") { run(.replace) }
            Button("Add a Suffix (-2)") { run(.addSuffix) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(conflicts.joined(separator: "\n"))
        }
    }

    private var chosen: [UUID] { session.documents.map(\.id).filter { !excluded.contains($0) } }

    private func binding(for id: UUID) -> Binding<Bool> {
        Binding(get: { !excluded.contains(id) }, set: { if $0 { excluded.remove(id) } else { excluded.insert(id) } })
    }

    private func start() {
        guard let folder else { return }
        let found = session.existingFileNames(for: chosen, in: folder)
        if found.isEmpty { run(.addSuffix) } else { conflicts = found }
    }

    private func run(_ choice: ConflictChoice) {
        guard let folder else { return }
        let documentIDs = chosen
        conflicts = []
        failures = []
        running = true
        Task {
            let report = await session.export(documentIDs, to: folder, searchableText: searchableText, existing: choice)
            running = false
            failures = report.failures.map(ScannerText.message(for:))
            let failed = Set(report.failures.compactMap { if case .cannotWrite(let name) = $0 { name } else { nil } })
            if !failed.isEmpty { excluded = Set(session.documents.filter { !failed.contains($0.name) }.map(\.id)) }
            guard failures.isEmpty else { return }
            if revealAfter, !report.written.isEmpty { NSWorkspace.shared.activateFileViewerSelecting(report.written) }
            dismiss()
        }
    }
}
