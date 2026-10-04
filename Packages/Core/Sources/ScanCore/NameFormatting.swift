import Foundation

public enum NameFormatting {
    public static let maxTitleWords = 6
    /// APFS allows 255 bytes; the app may still add "-99" and ".pdf".
    public static let maxFileNameBytes = 200

    /// ASCII words joined by dashes, only the first capitalized: « INFORMAȚII PUNCTUALE » → "Informatii-punctuale".
    /// Anything that is not a letter or a digit separates words, so a title never yields a path separator.
    public static func slug(_ text: String) -> String {
        let folded = text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX"))
        let words = folded.split { !($0.isASCII && ($0.isLetter || $0.isNumber)) }.prefix(maxTitleWords).map(String.init)
        guard let first = words.first else { return "" }
        return ([first.prefix(1).uppercased() + first.dropFirst()] + words.dropFirst()).joined(separator: "-")
    }

    /// The names used more than once, lowercased: APFS does not tell "Scan" from "scan".
    public static func duplicates(_ names: [String]) -> Set<String> {
        var seen = Set<String>()
        var repeated = Set<String>()
        for name in names.map({ $0.lowercased() }) where !seen.insert(name).inserted {
            repeated.insert(name)
        }
        return repeated
    }

    /// A name the user typed, safe as a file name: no path separator or colon, no leading dot, no ".pdf" at the end.
    public static func fileSafe(_ text: String) -> String {
        var name = String(text.map { $0 == "/" || $0 == ":" || $0.isNewline ? "-" : $0 })
            .trimmingCharacters(in: .whitespaces)
        if name.lowercased().hasSuffix(".pdf") { name.removeLast(4) }
        while name.hasPrefix(".") { name.removeFirst() }
        while name.utf8.count > maxFileNameBytes { name.removeLast() }
        return name.trimmingCharacters(in: .whitespaces)
    }

    /// Adds "-2", "-3"… to a name already used in the list or in `avoiding`, whatever its case:
    /// the default macOS file system does not tell "Scan.pdf" from "scan.pdf".
    public static func uniqued(_ names: [String], avoiding taken: Set<String> = []) -> [String] {
        var used = Set(taken.map { $0.lowercased() })
        return names.map { name in
            var candidate = name
            var number = 1
            while used.contains(candidate.lowercased()) {
                number += 1
                candidate = "\(name)-\(number)"
            }
            used.insert(candidate.lowercased())
            return candidate
        }
    }
}
