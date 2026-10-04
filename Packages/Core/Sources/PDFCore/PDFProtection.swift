import Foundation
import PDFKit

public enum PDFProtection {
    /// Quartz writes a password of printable ASCII only, and uses its first 32 bytes.
    public static func accepts(_ password: String) -> Bool {
        (1...32).contains(password.utf8.count) && password.utf8.allSatisfy { (0x20...0x7E).contains($0) }
    }

    /// A copy that opens only with `newPassword`, in AES-128: the strongest encryption PDFKit writes.
    public static func protected(_ data: Data, password: String = "", with newPassword: String) throws(PDFToolError) -> Data {
        guard accepts(newPassword) else { throw .invalidPassword }
        let document = try PDFDocumentValidation.open(data, password: password)
        try PDFDocumentValidation.rejectDigitalSignatures(data, password: password)
        // Without the owner password, Quartz writes the copy unencrypted.
        let options = [PDFDocumentWriteOption.userPasswordOption: newPassword, PDFDocumentWriteOption.ownerPasswordOption: newPassword]
        guard let output = document.dataRepresentation(options: options),
              let copy = PDFDocument(data: output), copy.isLocked, copy.unlock(withPassword: newPassword) else { throw .writeFailed }
        return output
    }

    /// A copy without encryption. PDFKit keeps the encryption of a document it writes whole, so the pages move
    /// into a new document, as in Organize.
    public static func unlocked(_ data: Data, password: String = "") async throws(PDFToolError) -> Data {
        let document = try PDFOrganizingDocument(data: data, password: password)
        let pages = await document.information().pageSizes.indices.map { OrganizedPage(id: $0) }
        return try await document.organizedData(pages: pages)
    }
}
