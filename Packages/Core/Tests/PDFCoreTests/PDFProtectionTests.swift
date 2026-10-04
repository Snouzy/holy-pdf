import Foundation
import PDFKit
import Testing
@testable import PDFCore

struct PDFProtectionTests {
    private func locked(_ label: String) throws -> Data {
        try #require(PDFDocument(data: fixture(label))?.dataRepresentation(options: [
            PDFDocumentWriteOption.userPasswordOption: "open", PDFDocumentWriteOption.ownerPasswordOption: "owner",
        ]))
    }

    /// Encryption ciphers each string on its own: a field value and a bookmark title can break while the page text holds.
    private func expectReadableStrings(in copy: PDFDocument, label: String) throws {
        let field = try #require(copy.page(at: 0)?.annotations.first { $0.type == "Widget" })
        #expect(field.widgetStringValue == label)
        #expect(copy.outlineRoot?.child(at: 0)?.label == "\(label) last")
    }

    private func isEncrypted(_ data: Data) -> Bool {
        data.range(of: Data("/Encrypt".utf8)) != nil
    }

    @Test func theProtectedCopyOpensOnlyWithItsPassword() throws {
        let output = try PDFProtection.protected(fixture("Payslip"), with: "s3same!")
        #expect(isEncrypted(output))
        #expect(output.range(of: Data("/AESV2".utf8)) != nil)
        let copy = try #require(PDFDocument(data: output))
        #expect(copy.isLocked)
        #expect(!copy.unlock(withPassword: "S3same!"))
        #expect(copy.unlock(withPassword: "s3same!"))
        #expect(copy.pageCount == 2)
        #expect(copy.page(at: 0)?.string?.contains("Payslip") == true)
        try expectReadableStrings(in: copy, label: "Payslip")
    }

    @Test func protectingAProtectedPDFReplacesItsPassword() throws {
        let source = try locked("Contract")
        #expect(throws: PDFToolError.passwordRequired) { try PDFProtection.protected(source, with: "new") }
        #expect(throws: PDFToolError.wrongPassword) { try PDFProtection.protected(source, password: "nope", with: "new") }
        let copy = try #require(PDFDocument(data: PDFProtection.protected(source, password: "open", with: "new")))
        #expect(!copy.unlock(withPassword: "open"))
        #expect(!copy.unlock(withPassword: "owner"))
        #expect(copy.unlock(withPassword: "new"))
    }

    @Test(arguments: ["", "caf\u{E9}", "\u{5BC6}\u{7801}", "tab\there", String(repeating: "a", count: 33)])
    func refusesAPasswordQuartzCannotWrite(password: String) {
        #expect(!PDFProtection.accepts(password))
        #expect(throws: PDFToolError.invalidPassword) { try PDFProtection.protected(fixture("Refused"), with: password) }
    }

    @Test(arguments: ["a", " two words ", "~!@#$%^&*()_+{}|:\"<>?`-=[]\\;',./", String(repeating: "a", count: 32)])
    func acceptsPrintableASCIIUpToThirtyTwoCharacters(password: String) throws {
        #expect(PDFProtection.accepts(password))
        let copy = try #require(PDFDocument(data: PDFProtection.protected(fixture("Accepted"), with: password)))
        #expect(copy.isLocked && copy.unlock(withPassword: password))
    }

    @Test func aSignedPDFIsNotProtected() {
        #expect(throws: PDFToolError.alreadySigned) { try PDFProtection.protected(fixture("Signed", digitalSignature: true), with: "secret") }
    }

    @Test func theUnlockedCopyHasNoEncryption() async throws {
        let source = try locked("Lease")
        #expect(isEncrypted(source))
        await #expect(throws: PDFToolError.passwordRequired) { try await PDFProtection.unlocked(source) }
        await #expect(throws: PDFToolError.wrongPassword) { try await PDFProtection.unlocked(source, password: "nope") }
        let output = try await PDFProtection.unlocked(source, password: "open")
        #expect(!isEncrypted(output))
        let copy = try #require(PDFDocument(data: output))
        #expect(!copy.isEncrypted && !copy.isLocked)
        #expect(copy.pageCount == 2)
        #expect(copy.page(at: 0)?.string?.contains("Lease") == true)
        #expect(copy.page(at: 0)?.annotations.filter { $0.type == "Link" }.count == 2)
        try expectReadableStrings(in: copy, label: "Lease")
    }
}
