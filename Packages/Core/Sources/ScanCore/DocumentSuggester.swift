import Foundation

public struct PageText: Hashable, Sendable {
    public var id: UUID
    public var lines: [TextLine]
    public var captureDate: Date?

    public init(id: UUID, lines: [TextLine], captureDate: Date?) {
        self.id = id
        self.lines = lines
        self.captureDate = captureDate
    }
}

/// Why a document was suggested; the app turns it into a sentence.
public enum Evidence: Hashable, Sendable, Codable {
    case pageMarker(String)
    case date(String)
    case title(String)
}

public struct DocumentSuggestion: Hashable, Sendable {
    public var pageIDs: [UUID]
    public var name: String
    public var evidence: [Evidence]
}

struct PageMarker: Equatable {
    var index: Int
    var total: Int?
    var text: String
}

struct FoundDate {
    var date: Date
    var text: String
}

/// Groups pages into documents and names them from their text. Rules: wiki/development/algorithm.md.
public enum DocumentSuggester {
    static let topMarkerZone = 0.10
    static let bottomMarkerZone = 0.88
    static let titleZone = 0.40
    static let maxTitleWords = 4
    static let minTitleConfidence = 0.5
    static let earliestYear = 1990
    /// An end of validity can fall before the photo, yet it is never the day the document was issued.
    static let validityKeywords = ["valabil", "valable", "valid until", "valid till", "valid through", "valid to", "expir"]

    /// Documents print Gregorian dates and names are ISO days, whatever calendar the user's system shows.
    public static func suggest(_ pages: [PageText], today: Date, calendar: Calendar = Calendar(identifier: .gregorian)) -> [DocumentSuggestion] {
        let groups = group(pages)
        let repeated = repeatedHeaderLines(groups)
        var unnamed = 0
        return groups.map { group in
            var evidence: [Evidence] = []
            if let marker = marker(in: group[0]), group.count > 1 || marker.total != nil {
                evidence.append(.pageMarker(marker.text))
            }
            let reference = group[0].captureDate ?? today
            let found = latestDate(in: group, notAfter: reference, calendar: calendar)
            if let found { evidence.append(.date(found.text)) }
            let day = isoDay(found?.date ?? reference, calendar: calendar)
            let heading = title(of: group[0], excluding: repeated)
            let slug = heading.map(NameFormatting.slug) ?? ""
            if !slug.isEmpty {
                if let heading { evidence.append(.title(heading)) }
            }
            if slug.isEmpty {
                unnamed += 1
                return DocumentSuggestion(pageIDs: group.map(\.id), name: "\(day)_Document-\(unnamed)", evidence: evidence)
            }
            return DocumentSuggestion(pageIDs: group.map(\.id), name: "\(day)_\(slug)", evidence: evidence)
        }
    }

    static func group(_ pages: [PageText]) -> [[PageText]] {
        var groups: [[PageText]] = []
        var previous: PageMarker?
        for page in pages {
            let current = marker(in: page)
            if let current, let previous, !groups.isEmpty, current.index == previous.index + 1, current.total == previous.total {
                groups[groups.count - 1].append(page)
            } else {
                groups.append([page])
            }
            previous = current
        }
        return groups
    }

    static func marker(in page: PageText) -> PageMarker? {
        let edgeLines = page.lines.filter { $0.box.y < topMarkerZone || $0.box.maxY > bottomMarkerZone }
        for line in edgeLines {
            let text = line.text
            if let match = text.firstMatch(of: /(?i)pagina\s+(\d+)\s+din\s+(\d+)/) ?? text.firstMatch(of: /(?i)page\s+(\d+)\s+(?:of|sur)\s+(\d+)/),
               let index = Int(match.1), let total = Int(match.2), index >= 1, index <= total {
                return PageMarker(index: index, total: total, text: String(match.0))
            }
            if let match = text.wholeMatch(of: /\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*/),
               let index = Int(match.1), let total = Int(match.2), index >= 1, index <= total {
                return PageMarker(index: index, total: total, text: text.trimmingCharacters(in: .whitespaces))
            }
        }
        for line in edgeLines where line.box.maxY > bottomMarkerZone && abs(line.box.midX - 0.5) < 0.1 {
            if let match = line.text.wholeMatch(of: /\s*(\d{1,3})\s*/), let index = Int(match.1) {
                return PageMarker(index: index, total: nil, text: String(match.1))
            }
        }
        return nil
    }

    /// The most recent date that is not after the reference day (the photo was taken after the
    /// document was issued), ignoring dates before 1990 such as birth dates.
    static func latestDate(in group: [PageText], notAfter reference: Date, calendar: Calendar) -> FoundDate? {
        guard let earliest = calendar.date(from: DateComponents(year: earliestYear, month: 1, day: 1)),
              let limit = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: reference)) else {
            return nil
        }
        return group.flatMap(\.lines)
            .filter { !mentionsValidity($0.text) }
            .flatMap { dates(in: $0.text, calendar: calendar) }
            .filter { $0.date >= earliest && $0.date < limit }
            .max { $0.date < $1.date }
    }

    static func mentionsValidity(_ text: String) -> Bool {
        let folded = text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX"))
        return validityKeywords.contains { folded.contains($0) }
    }

    static func dates(in text: String, calendar: Calendar) -> [FoundDate] {
        var found: [FoundDate] = []
        for match in text.matches(of: /\b(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})\b/) {
            if let date = makeDate(year: Int(match.3), month: Int(match.2), day: Int(match.1), calendar: calendar) {
                found.append(FoundDate(date: date, text: String(match.0)))
            }
        }
        for match in text.matches(of: /\b(\d{4})-(\d{2})-(\d{2})\b/) {
            if let date = makeDate(year: Int(match.1), month: Int(match.2), day: Int(match.3), calendar: calendar) {
                found.append(FoundDate(date: date, text: String(match.0)))
            }
        }
        return found
    }

    static func makeDate(year: Int?, month: Int?, day: Int?, calendar: Calendar) -> Date? {
        guard let year, let month, let day, (1...12).contains(month), (1...31).contains(day),
              let date = calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)),
              // The calendar rolls 31.02 over to March: reject it.
              calendar.component(.day, from: date) == day else {
            return nil
        }
        return date
    }

    static func isoDay(_ date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    /// Logos come back from Vision as low-confidence words. Body lines are long, and on a skewed
    /// page their boxes are taller than the title's.
    static func headerLines(_ page: PageText) -> [TextLine] {
        page.lines.filter {
            $0.box.y < titleZone && $0.text.filter(\.isLetter).count >= 3 && $0.confidence >= minTitleConfidence
                && $0.text.split(whereSeparator: \.isWhitespace).count <= maxTitleWords
        }
    }

    static func normalizedKey(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .filter { $0.isLetter || $0.isNumber }
    }

    /// Institution headers repeat across documents of a batch; they are not titles. Two documents
    /// of the same kind share a real title, so a big batch needs more repeats to call a line a header.
    static func repeatedHeaderLines(_ groups: [[PageText]]) -> Set<String> {
        var counts: [String: Int] = [:]
        for group in groups {
            for key in Set(group.flatMap(headerLines).map { normalizedKey($0.text) }) {
                counts[key, default: 0] += 1
            }
        }
        let minRepeats = max(2, (groups.count + 2) / 3)
        return Set(counts.filter { $0.value >= minRepeats }.keys)
    }

    /// The tallest line of the upper page; the higher one wins a tie.
    static func title(of page: PageText, excluding repeated: Set<String>) -> String? {
        headerLines(page)
            .filter { !repeated.contains(normalizedKey($0.text)) }
            .max { ($0.box.height, -$0.box.y) < ($1.box.height, -$1.box.y) }?
            .text
    }
}
