import SwiftUI
import Testing
@testable import PDFToolbox

@Suite(.serialized)
@MainActor
struct ImagesSnapshots {
    private static let folder = ScreenSnapshots.folder.appendingPathComponent("images")

    @Test func imagesToPDF() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("to-pdf-start-light", ImagesView().environment(ImagesSession()), in: Self.folder)
        let session = ImagesSession()
        await session.add([
            try pictureFile("Plage.jpg", in: folder, width: 1600, height: 900),
            try pictureFile("Phare.png", in: folder, width: 900, height: 1600, type: .png),
            try pictureFile("Carrelage.jpg", in: folder, width: 1200, height: 1200),
        ])
        for dark in [false, true] {
            try await snapshot("to-pdf-list-\(dark ? "dark" : "light")", ImagesView().environment(session), in: Self.folder, dark: dark)
        }
        try await snapshot("to-pdf-list-english", ImagesView().environment(session), in: Self.folder, language: "en")
        await session.save(to: folder.appendingPathComponent("Vacances.pdf"))
        try await snapshot("to-pdf-saved-light", ImagesView().environment(session), in: Self.folder)
    }

    @Test func pdfToImages() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        try await snapshot("to-images-start-dark", PageImagesView().environment(PageImagesSession()), in: Self.folder, dark: true)
        let source = folder.appendingPathComponent("Rapport annuel.pdf")
        try demoPDF(title: "Rapport annuel", pages: 4, color: 0).write(to: source)
        let session = PageImagesSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready && session.file.preview != nil }
        try await snapshot("to-images-ready-light", PageImagesView().environment(session), in: Self.folder)
        let album = folder.appendingPathComponent("Album de vacances.pdf")
        try photoPDF(title: "Album de vacances").write(to: album)
        let photos = PageImagesSession()
        photos.file.open(album)
        try await waitUntil { photos.file.state == .ready && photos.file.preview != nil && photos.photoCount != nil }
        photos.mode = .photos
        try await snapshot("to-images-photos-light", PageImagesView().environment(photos), in: Self.folder)
        let output = folder.appendingPathComponent("Images du rapport", isDirectory: true)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        await session.save(into: output, mode: .pages)
        #expect(session.savedURLs.count == 4)
        try await snapshot("to-images-saved-light", PageImagesView().environment(session), in: Self.folder)
        try await snapshot("to-images-saved-english", PageImagesView().environment(session), in: Self.folder, language: "en")
    }
}
