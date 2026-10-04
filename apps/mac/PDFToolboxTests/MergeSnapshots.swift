import PDFKit
import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct MergeSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("merging")

    @Test func homeAndMergeStart() async throws {
        for dark in [false, true] {
            let suffix = dark ? "dark" : "light"
            try await snapshot("home-\(suffix)", HomeView { _ in }, in: Self.folder, dark: dark)
            try await snapshot("start-\(suffix)", MergeView().environment(MergeSession()), in: Self.folder, dark: dark)
        }
    }

    @Test func orderedPDFsWithThumbnails() async throws {
        let directory = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: directory) }
        let names = ["Example application.pdf", "Supporting documents for the application.pdf", "Appendix.pdf"]
        let pageCounts = [2, 3, 1]
        let files = try names.enumerated().map { index, name in
            let url = directory.appendingPathComponent(name)
            try demoPDF(title: name, pages: pageCounts[index], color: index).write(to: url)
            return url
        }
        let session = MergeSession()
        session.add(files)
        try await waitUntil { !session.isBusy }
        try #require(session.canExport)
        #expect(session.totalPages == 6)
        for item in session.items { await session.loadPreview(id: item.id) }
        try #require(session.items.allSatisfy { $0.preview != nil })
        for dark in [false, true] {
            try await snapshot("documents-\(dark ? "dark" : "light")", MergeView().environment(session), in: Self.folder, dark: dark)
            let item = try #require(session.items.first)
            let preview = PagePreviewSheet(title: item.name, count: pageCounts[0],
                                           render: { try await session.pagePreview(id: item.id, pageIndex: $0) },
                                           message: MergeText.message)
            try await snapshot("preview-\(dark ? "dark" : "light")", preview, in: Self.folder, dark: dark)
        }
    }

    @Test func lockedAndUnreadableFiles() async throws {
        let directory = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: directory) }
        let readable = directory.appendingPathComponent("Example application.pdf")
        try demoPDF(title: "Example application", pages: 2, color: 0).write(to: readable)
        let locked = directory.appendingPathComponent("Protected attachment.pdf")
        let protectedData = try demoPDF(title: "Protected attachment", pages: 1, color: 1)
        let protected = try #require(PDFDocument(data: protectedData))
        let encrypted = try #require(protected.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "snapshot-password",
            PDFDocumentWriteOption.ownerPasswordOption: "snapshot-owner",
        ]))
        try encrypted.write(to: locked)
        let unreadable = directory.appendingPathComponent("Unreadable document.pdf")
        try Data("Synthetic invalid PDF fixture".utf8).write(to: unreadable)

        let session = MergeSession()
        session.add([readable, locked, unreadable])
        try await waitUntil { !session.isBusy }
        try #require(session.items.count == 3)
        try #require(session.items.contains { if case .locked = $0.status { return true }; return false })
        try #require(session.items.contains { if case .failed = $0.status { return true }; return false })
        #expect(!session.canExport)
        for item in session.items { await session.loadPreview(id: item.id) }
        for dark in [false, true] {
            try await snapshot("blocked-files-\(dark ? "dark" : "light")", MergeView().environment(session), in: Self.folder, dark: dark)
        }
    }
}
