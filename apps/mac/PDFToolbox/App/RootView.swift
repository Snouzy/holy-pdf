import SwiftUI

enum Tool: Hashable, CaseIterable, Identifiable {
    case scanner
    case sign
    case merge
    case organize
    case split
    case extract
    case watermark
    case pageNumbers
    case protect
    case unlock
    case compress
    case ocr
    case redact
    case imagesToPDF
    case pdfToImages
    case flatten
    case sheets
    case halves
    case pixelize
    case bookmarks
    case overlay
    case edit
    case pdfToWord

    var id: Self { self }

    var title: LocalizedStringResource {
        switch self {
        case .scanner: "Scanner"
        case .sign: "Sign a PDF"
        case .merge: "Merge PDFs"
        case .organize: "Organize pages"
        case .split: "Split a PDF"
        case .extract: "Extract pages"
        case .watermark: "Add a watermark"
        case .pageNumbers: "Number the pages"
        case .protect: "Protect a PDF"
        case .unlock: "Unlock a PDF"
        case .compress: "Compress a PDF"
        case .ocr: "Read the text (OCR)"
        case .redact: "Redact a PDF"
        case .imagesToPDF: "Images to PDF"
        case .pdfToImages: "PDF to images"
        case .flatten: "Flatten a PDF"
        case .pixelize: "Pixelize a PDF"
        case .halves: "Split pages in half"
        case .sheets: "Pages per sheet"
        case .bookmarks: "Add bookmarks"
        case .overlay: "Overlay two PDFs"
        case .edit: "Edit a PDF"
        case .pdfToWord: "PDF to Word"
        }
    }

    var monk: LocalizedStringResource {
        switch self {
        case .scanner: "Brother Snap"
        case .sign: "Brother Quill"
        case .merge: "Brother Staple"
        case .organize: "Brother Binder"
        case .split: "Brother Scissors"
        case .extract: "Brother Lens"
        case .watermark: "Brother Stamp"
        case .pageNumbers: "Brother Folio"
        case .protect: "Brother Padlock"
        case .unlock: "Brother Passkey"
        case .compress: "Brother Press"
        case .ocr: "Brother Reader"
        case .redact: "Brother Inkpot"
        case .imagesToPDF: "Brother Frame"
        case .pdfToImages: "Brother Illuminator"
        case .flatten: "Brother Roller"
        case .pixelize: "Brother Glass"
        case .halves: "Brother Trimmer"
        case .sheets: "Brother Mosaic"
        case .bookmarks: "Brother Ribbon"
        case .overlay: "Brother Layer"
        case .edit: "Brother Scribe"
        case .pdfToWord: "Brother Copyist"
        }
    }

    var summary: LocalizedStringKey {
        switch self {
        case .scanner: "Your document photos become clean PDFs."
        case .sign: "Draw your signature and save a signed copy."
        case .merge: "Bring several PDFs together in the order you choose."
        case .organize: "Reorder, rotate or remove pages, then save a copy."
        case .split: "Cut a PDF into several files, wherever you want."
        case .extract: "Keep only the pages you choose, in a new PDF."
        case .watermark: "Mark your pages with a text or a logo."
        case .pageNumbers: "Add a number to every page, where you want it."
        case .protect: "Put a password on a PDF: only those who know it open it."
        case .unlock: "Remove the password of a PDF, if you know it."
        case .compress: "Make a PDF lighter: the photos slim down, the words stay."
        case .ocr: "Scanned pages get their text back: search it, copy it."
        case .redact: "Cover what must stay private: the copy no longer holds it."
        case .imagesToPDF: "Bind your photos into one PDF, in the order you choose."
        case .pdfToImages: "Turn every page into a JPG image."
        case .flatten: "Freeze the filled fields and the annotations into the page."
        case .pixelize: "Turn every page into a picture: the text can no longer be copied."
        case .halves: "Cut each page in two: just right for a book scanned flat."
        case .sheets: "Put several pages on each sheet, to print less."
        case .bookmarks: "Mark the chapters of a PDF, to find them in one click."
        case .overlay: "Lay the pages of a PDF on those of another: a letterhead under a letter."
        case .edit: "Add text, images, shapes and highlighter to your pages."
        case .pdfToWord: "Copy the text and the pictures of a PDF into a Word document you can edit."
        }
    }

    var imageName: String {
        switch self {
        case .scanner: Brand.scannerMonk
        case .sign: "monk-sign"
        case .merge: "monk-merge"
        case .organize: "monk-organize"
        case .split: "monk-split"
        case .extract: "monk-extract"
        case .watermark: "monk-watermark"
        case .pageNumbers: "monk-page-numbers"
        case .protect: "monk-protect"
        case .unlock: "monk-unlock"
        case .compress: "monk-compress"
        case .ocr: "monk-ocr"
        case .redact: "monk-redact"
        case .imagesToPDF: "monk-images-to-pdf"
        case .pdfToImages: "monk-pdf-to-images"
        case .flatten: "monk-flatten"
        case .pixelize: "monk-pixelize"
        case .halves: "monk-split-in-half"
        case .sheets: "monk-pages-per-sheet"
        case .bookmarks: "monk-bookmarks"
        case .overlay: "monk-overlay"
        case .edit: "monk-edit"
        case .pdfToWord: "monk-pdf-to-word"
        }
    }
}

/// The site's five categories, in the site's order.
enum ToolCategory: CaseIterable, Identifiable {
    case organize, convert, edit, optimize, security

    var id: Self { self }

    var title: LocalizedStringResource {
        switch self {
        case .organize: "Organize"
        case .convert: "Convert"
        case .edit: "Edit"
        case .optimize: "Optimize"
        case .security: "Security"
        }
    }
}

extension Tool {
    /// Where the site puts the tool.
    var category: ToolCategory {
        switch self {
        case .merge, .organize, .split, .extract, .halves, .sheets, .bookmarks: .organize
        case .imagesToPDF, .pdfToImages, .pixelize, .pdfToWord: .convert
        case .sign, .watermark, .pageNumbers, .redact, .overlay, .edit: .edit
        case .scanner, .compress, .ocr, .flatten: .optimize
        case .protect, .unlock: .security
        }
    }

    /// The site's tools whose search words find this one. Organize also deletes and rotates pages on the Mac.
    var siteIDs: [String] {
        switch self {
        case .scanner: ["scan"]
        case .sign: ["sign"]
        case .merge: ["merge"]
        case .organize: ["organize", "delete-pages", "rotate"]
        case .split: ["split"]
        case .extract: ["extract-pages"]
        case .watermark: ["watermark"]
        case .pageNumbers: ["page-numbers"]
        case .protect: ["protect"]
        case .unlock: ["unlock"]
        case .compress: ["compress"]
        case .ocr: ["ocr"]
        case .redact: ["redact"]
        case .imagesToPDF: ["jpg-to-pdf"]
        case .pdfToImages: ["pdf-to-jpg"]
        case .flatten: ["flatten"]
        case .pixelize: ["pixelize"]
        case .halves: ["split-in-half"]
        case .sheets: ["pages-per-sheet"]
        case .bookmarks, .overlay: []
        case .pdfToWord: ["pdf-to-word"]
        case .edit: ["edit"]
        }
    }

    /// The search words of a tool the site does not have, separated by commas.
    var ownWords: LocalizedStringResource? {
        // Plain returns: the compiler does not collect for the catalog every branch of a `switch` used as a value.
        if self == .bookmarks { return "bookmarks, outline, contents, chapters, navigation" }
        if self == .overlay { return "overlay, superimpose, layer, letterhead, background, underlay" }
        return nil
    }
}

/// The site's tools that the Mac app does not have yet, in the site's order (`apps/web/src/cast.ts`), without the Scanner.
struct UpcomingTool: Identifiable, Sendable {
    let id: String
    let title: LocalizedStringResource
    /// A sleeping monk exported from the site: `sleep-<accessory>-<category>`.
    let image: String
    let category: ToolCategory

    static let all = [
        UpcomingTool(id: "web-to-pdf", title: "Web page to PDF", image: "sleep-book-convert", category: .convert),
    ]
}

struct RootView: View {
    let split: PagePickingSession
    let extract: PagePickingSession
    let protect: ProtectionSession
    let unlock: ProtectionSession
    @State private var path: [Tool] = []

    var body: some View {
        NavigationStack(path: $path) {
            HomeView { path.append($0) }
                .navigationDestination(for: Tool.self) { tool in
                    switch tool {
                    case .scanner: ScannerView()
                    case .sign: SigningView()
                    case .merge: MergeView()
                    case .organize: OrganizingView()
                    case .split: PagePickingView(session: split)
                    case .extract: PagePickingView(session: extract)
                    case .watermark: WatermarkView()
                    case .pageNumbers: PageNumberView()
                    case .protect: ProtectionView(session: protect)
                    case .unlock: ProtectionView(session: unlock)
                    case .compress: CompressView()
                    case .ocr: OCRView()
                    case .redact: RedactView()
                    case .imagesToPDF: ImagesView()
                    case .pdfToImages: PageImagesView()
                    case .flatten: FlattenView()
                    case .pixelize: PixelizeView()
                    case .halves: HalvesView()
                    case .sheets: SheetsView()
                    case .bookmarks: BookmarksView()
                    case .overlay: OverlayView()
                    case .edit: EditView()
                    case .pdfToWord: WordView()
                    }
                }
        }
    }
}

struct HomeView: View {
    var open: (Tool) -> Void
    @State private var query = ""

    var body: some View {
        // ImageRenderer leaves out the content of a ScrollView: the screen snapshots render HomeContent.
        ScrollView { HomeContent(query: query, reset: { query = "" }, open: open) }
            .navigationTitle("Holy PDF")
            .searchable(text: $query, prompt: "Search a tool")
    }
}

struct HomeContent: View {
    var query = ""
    var reset: () -> Void = {}
    var open: (Tool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 36) {
            VStack(alignment: .leading, spacing: 10) {
                HighlightedTitle(text: "Your PDFs, **on your Mac** 🙏", size: 44)
                Text("Everything runs here: nothing is sent.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            if let found = ToolSearch.tools(for: query, in: ToolCatalog.entries()) { results(found) } else { categories }
        }
        .padding(32)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var categories: some View {
        ForEach(ToolCategory.allCases) { category in
            VStack(alignment: .leading, spacing: 16) {
                Text(category.title).font(.brandTitle(24))
                cards(Tool.allCases.filter { $0.category == category })
                sleepers(UpcomingTool.all.filter { $0.category == category })
            }
        }
    }

    @ViewBuilder private func results(_ found: [String]) -> some View {
        let ready = found.compactMap { id in Tool.allCases.first { ToolCatalog.key($0) == id } }
        let sleeping = found.compactMap { id in UpcomingTool.all.first { ToolCatalog.key($0) == id } }
        if found.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("No monk does that… yet").font(.brandTitle(24))
                Text("Try another word, such as “merge”, “reduce” or “sign”.").foregroundStyle(.secondary)
                Button("See all the monks", action: reset).buttonHover()
            }
        } else {
            VStack(alignment: .leading, spacing: 16) {
                Text("Monks found: \(found.count)").font(.brandTitle(24))
                cards(ready)
                sleepers(sleeping)
            }
        }
    }

    @ViewBuilder private func cards(_ tools: [Tool]) -> some View {
        if !tools.isEmpty {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 340), spacing: 16, alignment: .top)], alignment: .leading, spacing: 16) {
                ForEach(tools) { tool in
                    Button { open(tool) } label: { ToolCard(tool: tool) }
                        .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder private func sleepers(_ tools: [UpcomingTool]) -> some View {
        if !tools.isEmpty {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 104, maximum: 104), spacing: 16, alignment: .top)], alignment: .leading, spacing: 20) {
                ForEach(tools) { SleepingTool(tool: $0) }
            }
        }
    }
}

struct ToolCard: View {
    let tool: Tool
    @State private var hovering = false

    var body: some View {
        HStack(spacing: 16) {
            ZStack(alignment: .bottomTrailing) {
                if tool == .scanner {
                    Image(Brand.scannerScene).resizable().frame(width: 88, height: 88)
                    Image(Brand.scannerMonk).resizable().scaledToFit().frame(width: 64).offset(x: 20, y: 8)
                } else {
                    Image(tool.imageName).resizable().scaledToFit().frame(width: 100, height: 112)
                }
            }
            .frame(width: 112, height: 112, alignment: .leading)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
                Text(tool.title).font(.brandTitle(22))
                Text(tool.monk).font(.headline).foregroundStyle(.tint)
                Text(tool.summary).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 164, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14)
            .strokeBorder(hovering ? Color.accentColor : Color(nsColor: .separatorColor), lineWidth: hovering ? 2 : 1))
        .shadow(color: .black.opacity(hovering ? 0.14 : 0.06), radius: hovering ? 14 : 6, y: hovering ? 6 : 2)
        .scaleEffect(hovering ? 1.01 : 1)
        .contentShape(RoundedRectangle(cornerRadius: 14))
        .onHover { hovering = $0 }
        .pointerStyle(.link)
        .animation(.easeOut(duration: 0.15), value: hovering)
    }
}

struct SleepingTool: View {
    let tool: UpcomingTool

    var body: some View {
        VStack(spacing: 8) {
            Image(tool.image)
                .resizable()
                .scaledToFit()
                .frame(width: 76)
                .overlay(alignment: .bottom) { SoonStamp().offset(y: 6) }
            Text(tool.title)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(width: 104)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("\(Text(tool.title)), coming soon"))
    }
}

/// The red « Bientôt » stamp of the site's upcoming tools.
struct SoonStamp: View {
    var body: some View {
        Text("Soon")
            .font(.caption2.weight(.heavy))
            .textCase(.uppercase)
            .foregroundStyle(Color("Stamp"))
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .background(.background, in: RoundedRectangle(cornerRadius: 3))
            .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color("Stamp"), lineWidth: 1.5))
            .rotationEffect(.degrees(-8))
    }
}
