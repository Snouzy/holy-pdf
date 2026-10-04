import AppKit
import Foundation
import Testing
@testable import PDFToolbox

@MainActor
struct WordSessionTests {
    @Test func copiesThePDFIntoAWordDocumentAndLeavesTheOriginalAlone() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("Report.pdf")
        try demoPDF(title: "Report", pages: 3, color: 0).write(to: source)
        let original = try Data(contentsOf: source)
        let session = WordSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        #expect(session.savedURL == nil)

        let output = folder.appendingPathComponent("Report-word.docx")
        await session.save(to: output)
        #expect(session.file.errorMessage == nil)
        #expect(session.savedURL == output)
        #expect(session.file.step == nil)
        // macOS reads the document as Word does.
        let read = try NSAttributedString(url: output, options: [.documentType: NSAttributedString.DocumentType.officeOpenXML], documentAttributes: nil)
        #expect(read.string.contains("EXAMPLE 1") && read.string.contains("EXAMPLE 3") && read.string.contains("Report"))
        #expect(read.string.components(separatedBy: "\u{0C}").count == 3, "A page of Word for each page")
        #expect(try Data(contentsOf: source) == original)

        session.file.reset()
        #expect(session.savedURL == nil)
    }

    @Test func aFolderThatRefusesTheFileSaysSo() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let source = folder.appendingPathComponent("Report.pdf")
        try demoPDF(title: "Report", pages: 1, color: 0).write(to: source)
        let locked = folder.appendingPathComponent("locked", isDirectory: true)
        try FileManager.default.createDirectory(at: locked, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o555])
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: locked.path) }
        let session = WordSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        await session.save(to: locked.appendingPathComponent("Report-word.docx"))
        #expect(session.savedURL == nil)
        #expect(session.file.errorMessage?.contains("Word") == true)
        #expect(session.file.state == .ready)
    }
}
