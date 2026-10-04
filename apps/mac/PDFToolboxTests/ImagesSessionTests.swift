import Foundation
import ImageIO
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct ImagesSessionTests {
    @Test func bindsTheImagesInTheOrderOnScreen() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let wide = try pictureFile("Beach.jpg", in: folder, width: 400, height: 200)
        let tall = try pictureFile("Tower.png", in: folder, width: 200, height: 400, type: .png)
        let square = try pictureFile("Tile.jpg", in: folder, width: 300, height: 300)
        let session = ImagesSession()
        #expect(!session.canSave)
        await session.add([wide, tall, square])
        #expect(session.items.map(\.name) == ["Beach.jpg", "Tower.png", "Tile.jpg"])
        #expect(session.items.map(\.pixels) == [CGSize(width: 400, height: 200), CGSize(width: 200, height: 400), CGSize(width: 300, height: 300)])
        #expect(session.hasUnsavedChanges)
        session.move(from: IndexSet(integer: 0), to: 3)
        session.remove(session.items[1].id)
        #expect(session.items.map(\.name) == ["Tower.png", "Beach.jpg"])

        let output = folder.appendingPathComponent("Album.pdf")
        await session.save(to: output)
        #expect(session.errorMessage == nil)
        #expect(session.lastSavedURL == output)
        #expect(!session.hasUnsavedChanges)
        let document = try #require(PDFDocument(url: output))
        #expect(document.pageCount == 2)
        let first = try #require(document.page(at: 0)?.bounds(for: .mediaBox).size)
        let second = try #require(document.page(at: 1)?.bounds(for: .mediaBox).size)
        #expect(first.height > first.width, "The tall picture comes first, on a portrait page")
        #expect(second.width > second.height)
        await session.add([square])
        #expect(session.hasUnsavedChanges && session.lastSavedURL == nil)
    }

    @Test func aScannedTIFFGivesOneRowForEachOfItsPages() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let scan = folder.appendingPathComponent("Scan.tiff")
        let data = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(data, "public.tiff" as CFString, 3, nil))
        for _ in 0..<3 {
            let context = try #require(CGContext(data: nil, width: 200, height: 300, bitsPerComponent: 8, bytesPerRow: 0,
                                                 space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue))
            context.setFillColor(gray: 0.8, alpha: 1)
            context.fill(CGRect(x: 0, y: 0, width: 200, height: 300))
            CGImageDestinationAddImage(destination, try #require(context.makeImage()), nil)
        }
        try #require(CGImageDestinationFinalize(destination))
        try (data as Data).write(to: scan)
        let session = ImagesSession()
        await session.add([scan])
        #expect(session.items.map(\.name) == ["Scan.tiff (1)", "Scan.tiff (2)", "Scan.tiff (3)"])
        let output = folder.appendingPathComponent("Scan.pdf")
        await session.save(to: output)
        #expect(PDFDocument(url: output)?.pageCount == 3)
    }

    @Test func aRowMovesUpAndDownByItsButtons() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = ImagesSession()
        await session.add([try pictureFile("A.jpg", in: folder, width: 50, height: 50), try pictureFile("B.jpg", in: folder, width: 50, height: 50),
                           try pictureFile("C.jpg", in: folder, width: 50, height: 50)])
        session.move(session.items[2].id, by: -1)
        #expect(session.items.map(\.name) == ["A.jpg", "C.jpg", "B.jpg"])
        session.move(session.items[0].id, by: 1)
        #expect(session.items.map(\.name) == ["C.jpg", "A.jpg", "B.jpg"])
        session.move(session.items[0].id, by: -1)
        session.move(session.items[2].id, by: 1)
        #expect(session.items.map(\.name) == ["C.jpg", "A.jpg", "B.jpg"], "The first row does not go up, the last does not go down")
    }

    @Test func aFileThatIsNotAnImageIsLeftOutAndNamed() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let good = try pictureFile("Good.jpg", in: folder, width: 100, height: 100)
        let bad = folder.appendingPathComponent("Notes.jpg")
        try Data("not an image".utf8).write(to: bad)
        let session = ImagesSession()
        await session.add([good, bad])
        #expect(session.items.map(\.name) == ["Good.jpg"])
        #expect(session.errorMessage?.contains("Notes.jpg") == true)
    }

    @Test func nothingIsSavedWithoutAnImageAndTheImagesStayAsTheyAre() async throws {
        let folder = try temporaryFolder()
        defer { try? FileManager.default.removeItem(at: folder) }
        let session = ImagesSession()
        await session.save(to: folder.appendingPathComponent("empty.pdf"))
        #expect(!FileManager.default.fileExists(atPath: folder.appendingPathComponent("empty.pdf").path))
        let picture = try pictureFile("Photo.jpg", in: folder, width: 100, height: 100)
        let original = try Data(contentsOf: picture)
        await session.add([picture])
        session.removeAll()
        #expect(session.items.isEmpty && !session.hasUnsavedChanges)
        await session.add([picture])
        #expect(try Data(contentsOf: picture) == original)
    }
}
