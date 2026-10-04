import Foundation
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct ProtectionSessionTests {
    private func opened(_ mode: ProtectionSession.Mode, password: String? = nil) async throws -> (session: ProtectionSession, source: URL, folder: URL) {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("Payslip.pdf")
        var data = try demoPDF(title: "Payslip", pages: 2, color: 0)
        if let password {
            data = try #require(PDFDocument(data: data)?.dataRepresentation(options: [
                PDFDocumentWriteOption.userPasswordOption: password, PDFDocumentWriteOption.ownerPasswordOption: "owner",
            ]))
        }
        try data.write(to: source)
        let session = ProtectionSession(mode: mode)
        session.file.open(source)
        try await waitUntil { session.file.state == .ready || session.file.state == .locked }
        return (session, source, folder)
    }

    @Test func protectWaitsForAPasswordTypedTwice() async throws {
        let (session, _, folder) = try await opened(.protect)
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(!session.canSave)
        session.password = "s3same"
        #expect(!session.canSave && !session.confirmationDiffers)
        session.confirmation = "s3xame"
        #expect(!session.canSave && session.confirmationDiffers)
        session.confirmation = "s3same"
        #expect(session.canSave && !session.confirmationDiffers && !session.passwordIsRefused)
        session.password = "sésame"
        session.confirmation = "sésame"
        #expect(!session.canSave && session.passwordIsRefused)
        await session.saveCopy(to: folder.appendingPathComponent("never.pdf"))
        #expect(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("never.pdf").path))
    }

    @Test func theProtectedCopyOpensWithThePasswordAndTheFieldsAreEmptied() async throws {
        let (session, source, folder) = try await opened(.protect)
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        session.password = "s3same"
        session.confirmation = "s3same"
        let output = folder.appendingPathComponent("Payslip-protected.pdf")
        await session.saveCopy(to: output)
        #expect(session.file.errorMessage == nil)
        #expect(session.file.lastSavedURL == output)
        let copy = try #require(PDFDocument(url: output))
        #expect(copy.isLocked && !copy.unlock(withPassword: "") && copy.unlock(withPassword: "s3same"))
        #expect(copy.pageCount == 2)
        #expect(try Data(contentsOf: source) == original)
        #expect(session.password.isEmpty && session.confirmation.isEmpty, "A password left in the fields would lock the next PDF unseen")
    }

    @Test func aPasswordDoesNotFollowTheUserToAnotherPDF() async throws {
        let (session, source, folder) = try await opened(.protect)
        defer { try? FileManager.default.removeItem(at: folder) }
        session.password = "s3same"
        session.confirmation = "s3same"
        await session.saveCopy(to: source)
        #expect(session.file.errorMessage != nil)
        #expect(session.password == "s3same", "A refused save keeps the password for the next try")
        let other = folder.appendingPathComponent("Other.pdf")
        try demoPDF(title: "Other", pages: 1, color: 1).write(to: other)
        session.file.open(other)
        #expect(session.password.isEmpty && session.confirmation.isEmpty)
        try await waitUntil { session.file.state == .ready }
        #expect(!session.canSave)
    }

    @Test func theDifferenceShowsOnlyOnceTheConfirmationGoesWrong() async throws {
        let session = ProtectionSession(mode: .protect)
        session.password = "s3same"
        session.confirmation = "s3s"
        #expect(!session.confirmationDiffers && !session.canSave)
        session.confirmation = "s3x"
        #expect(session.confirmationDiffers)
        session.confirmation = "s3same!"
        #expect(session.confirmationDiffers)
    }

    @Test func unlockRefusesAtTheOpeningWhatItCannotKeep() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let layered = folder.appendingPathComponent("Layers.pdf")
        try rawPDF(catalog: "/OCProperties<</OCGs[]/D<<>>>>").write(to: layered)
        let session = ProtectionSession(mode: .unlock)
        session.file.open(layered)
        try await waitUntil { session.file.errorMessage != nil }
        #expect(session.file.state == .empty)
        let tagged = folder.appendingPathComponent("Tagged.pdf")
        try rawPDF(catalog: "/MarkInfo<</Marked true>>").write(to: tagged)
        session.file.open(tagged)
        try await waitUntil { session.file.state == .ready }
        #expect(session.file.notices.count == 1)
        let protect = ProtectionSession(mode: .protect)
        protect.file.open(layered)
        try await waitUntil { protect.file.state == .ready }
        #expect(protect.file.notices.isEmpty, "Protect writes the whole document: it keeps the layers")
    }

    private func rawPDF(catalog: String) -> Data {
        let objects = ["<</Type/Catalog/Pages 2 0 R\(catalog)>>", "<</Type/Pages/Count 1/Kids[3 0 R]>>", "<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>"]
        var text = "%PDF-1.7\n"
        var offsets: [Int] = []
        for (index, object) in objects.enumerated() {
            offsets.append(text.utf8.count)
            text += "\(index + 1) 0 obj\n\(object)\nendobj\n"
        }
        let at = text.utf8.count
        text += "xref\n0 4\n0000000000 65535 f \n" + offsets.map { String(format: "%010d 00000 n \n", $0) }.joined()
        text += "trailer\n<</Size 4/Root 1 0 R>>\nstartxref\n\(at)\n%%EOF\n"
        return Data(text.utf8)
    }

    @Test func aProtectedPDFTakesANewPassword() async throws {
        let (session, _, folder) = try await opened(.protect, password: "old")
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(session.file.state == .locked)
        session.file.unlock("old")
        try await waitUntil { session.file.state == .ready }
        session.password = "new"
        session.confirmation = "new"
        let output = folder.appendingPathComponent("again.pdf")
        await session.saveCopy(to: output)
        let copy = try #require(PDFDocument(url: output))
        #expect(!copy.unlock(withPassword: "old") && copy.unlock(withPassword: "new"))
    }

    @Test func unlockSavesACopyWithoutEncryption() async throws {
        let (session, source, folder) = try await opened(.unlock, password: "open")
        defer { try? FileManager.default.removeItem(at: folder) }
        let original = try Data(contentsOf: source)
        #expect(!session.canSave)
        session.file.unlock("open")
        try await waitUntil { session.file.state == .ready }
        #expect(session.canSave)
        let output = folder.appendingPathComponent("Payslip-unlocked.pdf")
        await session.saveCopy(to: output)
        #expect(session.file.errorMessage == nil)
        let copy = try #require(PDFDocument(url: output))
        #expect(!copy.isEncrypted && !copy.isLocked)
        #expect(copy.pageCount == 2)
        #expect(copy.page(at: 0)?.string?.contains("EXAMPLE 1") == true)
        #expect(try Data(contentsOf: source) == original)
    }

    @Test func aPDFWithoutPasswordHasNothingToUnlock() async throws {
        let (session, _, folder) = try await opened(.unlock)
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(session.file.state == .ready)
        #expect(!session.canSave)
        await session.saveCopy(to: folder.appendingPathComponent("never.pdf"))
        #expect(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("never.pdf").path))
    }

    @Test func aPDFThatOnlyLimitsPrintingAndCopyingIsUnlockedToo() async throws {
        let (session, _, folder) = try await opened(.unlock, password: "")
        defer { try? FileManager.default.removeItem(at: folder) }
        #expect(session.file.state == .ready && session.file.isEncrypted)
        #expect(session.canSave)
        let output = folder.appendingPathComponent("free.pdf")
        await session.saveCopy(to: output)
        let copy = try #require(PDFDocument(url: output))
        #expect(!copy.isEncrypted && copy.allowsCopying && copy.allowsPrinting)
    }
}
