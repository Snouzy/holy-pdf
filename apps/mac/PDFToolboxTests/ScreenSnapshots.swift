import AppKit
import ImageIO
import ScanCore
import ScanSession
import SwiftUI
import Testing
@testable import PDFToolbox

/// Renders each screen to a PNG for review. ImageRenderer draws text fields, checkboxes and sliders as placeholders,
/// and leaves the content of a ScrollView out.
@MainActor
struct ScreenSnapshots {
    static let folder = FileManager.default.temporaryDirectory.appending(path: "screens")

    func snapshot(_ name: String, _ view: some View, width: Double = 1280, height: Double = 800, dark: Bool = false) throws {
        let renderer = ImageRenderer(content: view
            .frame(width: width, height: height)
            .background(Color(nsColor: .windowBackgroundColor))
            .environment(\.colorScheme, dark ? .dark : .light))
        // NSColor and the catalog's colors resolve against the drawing appearance, not the SwiftUI environment.
        var rendered: CGImage?
        NSAppearance(named: dark ? .darkAqua : .aqua)?.performAsCurrentDrawingAppearance { rendered = renderer.cgImage }
        let image = try #require(rendered)
        try FileManager.default.createDirectory(at: Self.folder, withIntermediateDirectories: true)
        let url = Self.folder.appending(path: "\(name).png")
        let png = try #require(NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]))
        try png.write(to: url)
        print("snapshot: \(url.path)")
    }

    func demo() async -> ScannerSession {
        let session = DemoSession.make()
        await session.waitUntilIdle()
        return session
    }

    @Test func home() throws {
        try snapshot("home", HomeContent { _ in })
        try snapshot("home-dark", HomeContent { _ in }, dark: true)
        // Fixed height, as in the app's ScrollView: in a bounded frame the grid takes the height the title needs to wrap.
        try snapshot("home-narrow", HomeContent { _ in }.fixedSize(horizontal: false, vertical: true), width: 420, height: 3300)
        try snapshot("home-search", HomeContent(query: "mot de passe") { _ in })
        try snapshot("home-search-word", HomeContent(query: "word") { _ in })
        try snapshot("home-search-empty", HomeContent(query: "tableur") { _ in }, dark: true)
    }

    @Test func start() throws {
        try snapshot("start", StartView {}.environment(ScannerSession()))
        try snapshot("start-dark", StartView {}.environment(ScannerSession()), dark: true)
    }

    @Test func board() async throws {
        let session = await demo()
        #expect(session.documents.count == 3)
        try snapshot("board", BoardRows(reviewOnly: false, open: { _ in }, delete: { _ in }, download: { _ in })
            .environment(session)
            .defaultAppStorage(try #require(UserDefaults(suiteName: "ScreenSnapshots"))))
    }

    @Test func tips() throws {
        try snapshot("tips", TipsBanner {}.padding(24), width: 900, height: 110)
        try snapshot("tips-dark", TipsBanner {}.padding(24), width: 900, height: 110, dark: true)
    }

    @Test func thumbnails() async throws {
        let session = await demo()
        let pages = session.pageOrder.compactMap { session.pages[$0] }
        let queued = ScanPage(url: URL(fileURLWithPath: "/demo/IMG_0009.heic"))
        try snapshot("thumbnails", HStack(alignment: .top, spacing: 14) {
            ForEach(pages) { PageThumbnail(page: $0, label: $0.url.lastPathComponent) }
            PageThumbnail(page: queued, label: queued.url.lastPathComponent)
            NewDocumentSlot()
        }.padding(24), width: 900, height: 220)
    }

    @Test func correctionPanes() async throws {
        let session = await demo()
        let id = try #require(session.pagesToReview.first)
        let page = try #require(session.pages[id])
        let processed = try #require(page.status.result?.processed)
        let photo = try ImageLoader.load(page.url, maxLongSide: 2048).image
        let result = try #require(CGImageSourceCreateWithData(processed.jpeg as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })
        try snapshot("correction", HStack(spacing: 0) {
            CornerEditor(photo: photo, quad: processed.quad) { _ in }.padding(16)
            Divider()
            ResultView(image: result, erasing: true, brush: 30) { _ in }.padding(16)
        })
    }

    @Test func export() async throws {
        let session = await demo()
        try snapshot("export", ExportSheet(folder: .constant(nil)) { _ in }.environment(session), width: 620, height: 640)
    }
}
