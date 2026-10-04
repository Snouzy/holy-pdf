import Foundation

/// The home's search, with the site's rules (`apps/web/src/home/search.ts`): the names on the cards and the site's word
/// lists, accents and case ignored, a typo forgiven, the words everybody types (« pdf », « de », « fichier ») left out.
enum ToolSearch {
    struct Entry {
        let id: String
        let ready: Bool
        let names: [String]
        let terms: [String]
    }

    private static let stopWords: Set<String> = [
        "pdf", "pdfs", "de", "des", "du", "d", "un", "une", "le", "la", "les", "l", "en", "mon", "ma", "mes", "a", "au", "aux", "et", "pour", "sur",
        "the", "an", "my", "to", "of", "and", "for", "into", "file", "files", "fichier", "fichiers", "document", "documents", "page", "pages",
        "gratuit", "gratuite", "gratuitement", "ligne", "comment", "deux", "free", "online", "how", "two",
    ]
    private static let formats: Set<String> = ["jpg", "jpeg", "png", "image", "images", "photo", "photos", "picture", "pictures", "word", "docx", "doc", "web", "html"]

    private static func normalize(_ text: String) -> String {
        let plain = text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil).lowercased()
        return plain.split { !($0.isASCII && ($0.isLetter || $0.isNumber)) }.joined(separator: " ")
    }

    private static func words(_ text: String) -> [String] {
        normalize(text).split(separator: " ").map(String.init).filter { !stopWords.contains($0) }
            .map { $0.hasSuffix("s") && formats.contains(String($0.dropLast())) ? String($0.dropLast()) : $0 }
    }

    /// Optimal string alignment: an insertion, a deletion, a substitution or two neighbours swapped cost 1 each.
    private static func distance(_ a: [Character], _ b: [Character]) -> Int {
        guard !a.isEmpty, !b.isEmpty else { return max(a.count, b.count) }
        var before: [Int] = []
        var above = Array(0...b.count)
        for i in 1...a.count {
            var row = [i]
            for j in 1...b.count {
                var best = min(above[j] + 1, row[j - 1] + 1, above[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1))
                if i > 1, j > 1, a[i - 1] == b[j - 2], a[i - 2] == b[j - 1] { best = min(best, before[j - 2] + 1) }
                row.append(best)
            }
            (before, above) = (above, row)
        }
        return above[b.count]
    }

    private static func wordScore(_ asked: String, _ word: String) -> Int {
        if asked == word { return 3 }
        if word.hasPrefix(asked) { return 2 }
        let typos = asked.count >= 7 ? 2 : asked.count >= 4 ? 1 : 0
        guard typos > 0 else { return 0 }
        // A word still being typed is also compared with the start of the word, at the same length.
        let a = Array(asked), whole = Array(word)
        return min(distance(a, whole), distance(a, Array(whole.prefix(a.count)))) <= typos ? 1 : 0
    }

    /// True when « pdf » comes before an image or format word, false when it comes after, nil without both.
    private static func pdfFirst(_ text: String) -> Bool? {
        let all = normalize(text).split(separator: " ").map(String.init)
        guard let pdf = all.firstIndex(where: { $0 == "pdf" || $0 == "pdfs" }), let format = all.firstIndex(where: formats.contains) else { return nil }
        return pdf < format
    }

    /// Nil when the query asks nothing: it is empty, or made of stop words.
    private static func rank(_ query: String, _ entries: [Entry]) -> [String]? {
        let asked = words(query)
        guard !asked.isEmpty else { return nil }
        let hits = entries.map { entry in asked.map { word in (entry.names + entry.terms).flatMap(words).map { wordScore(word, $0) }.max() ?? 0 } }
        // A word no tool knows (« gratuitement », « online ») would empty the result: it is left out.
        let known = asked.indices.filter { word in hits.contains { $0[word] > 0 } }
        let whole = normalize(query)
        let direction = pdfFirst(query)
        var matches: [(id: String, score: Double, weakest: Int, agrees: Bool)] = []
        for (entry, entryHits) in zip(entries, hits) {
            let points = known.map { entryHits[$0] }
            guard let weakest = points.min(), weakest > 0 else { continue }
            var score = (entry.ready ? 0.5 : 0) + Double(points.reduce(0, +))
            if whole.contains(" "), (entry.names + entry.terms).contains(where: { normalize($0).contains(whole) }) { score += 2 }
            let agrees = direction != nil && entry.names.compactMap(pdfFirst).first == direction
            matches.append((entry.id, score, weakest, agrees))
        }
        // A typo is only a fallback: « conv » must not bring « concaténer » when « convertir » starts with it.
        let exact = matches.filter { $0.weakest >= 2 }
        return (exact.isEmpty ? matches : exact).enumerated()
            .sorted { ($0.element.score, $0.element.agrees ? 1 : 0, -$0.offset) > ($1.element.score, $1.element.agrees ? 1 : 0, -$1.offset) }
            .map(\.element.id)
    }

    /// The ids of the tools that answer `query`, best first; empty when no tool does. Nil when the query asks
    /// nothing yet: the home then keeps its categories.
    static func tools(for query: String, in entries: [Entry]) -> [String]? {
        let found = rank(query, entries)
        let text = normalize(query)
        let typed = text.split(separator: " ").last.map(String.init) ?? ""
        // « pd » on the way to « pdf » finds nothing yet: a last word that starts a stop word waits for the next letter.
        guard found == [], !typed.isEmpty, stopWords.contains(where: { $0.hasPrefix(typed) }) else { return found }
        return rank(String(text.dropLast(typed.count)), entries)
    }
}

/// The home's tools as the search sees them: the Mac's names, and the site's names and words for each tool.
@MainActor
enum ToolCatalog {
    private struct SiteEntry: Decodable {
        let names: [String]
        let terms: [String]
    }

    /// `SearchTerms.json` is a copy of the site's search index, by language then by the site's tool id.
    private static let site: [String: [String: SiteEntry]] = {
        guard let url = Bundle.main.url(forResource: "SearchTerms", withExtension: "json"), let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONDecoder().decode([String: [String: SiteEntry]].self, from: data)) ?? [:]
    }()

    static func key(_ tool: Tool) -> String { String(describing: tool) }
    static func key(_ tool: UpcomingTool) -> String { "upcoming:\(tool.id)" }

    /// `language` is the language of the interface, not of the region: a Mac set to France with the app in English
    /// must search in English.
    static func entries(language: String = Bundle.main.preferredLocalizations.first ?? "en") -> [ToolSearch.Entry] {
        let words = site[language == "fr" ? "fr" : "en"] ?? [:]
        func text(_ resource: LocalizedStringResource) -> String {
            var resource = resource
            resource.locale = Locale(identifier: language)
            return String(localized: resource)
        }
        func entry(_ id: String, ready: Bool, names: [String], siteIDs: [String], own: String = "") -> ToolSearch.Entry {
            let entries = siteIDs.compactMap { words[$0] }
            // The site's names carry words the Mac's titles do not: « convertir », "add".
            return ToolSearch.Entry(id: id, ready: ready, names: names + entries.flatMap(\.names),
                                    terms: entries.flatMap(\.terms) + own.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) })
        }
        return Tool.allCases.map { entry(key($0), ready: true, names: [text($0.title), text($0.monk)], siteIDs: $0.siteIDs, own: $0.ownWords.map(text) ?? "") }
            + UpcomingTool.all.map { entry(key($0), ready: false, names: [text($0.title)], siteIDs: [$0.id]) }
    }
}
