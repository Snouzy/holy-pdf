import Foundation
import Testing
import TestSupport
@testable import ScanCLI

struct OptionsTests {
    @Test func parsesOutputEditsAndPhotos() throws {
        let options = try Options.parse(["--out", "/tmp/out", "--edits", "/tmp/edits.json", "/tmp/a.heic", "/tmp/b.heic"])
        #expect(options == Options(photos: [URL(fileURLWithPath: "/tmp/a.heic"), URL(fileURLWithPath: "/tmp/b.heic")],
                                   outputDirectory: URL(fileURLWithPath: "/tmp/out"),
                                   editsFile: URL(fileURLWithPath: "/tmp/edits.json")))
    }

    @Test func expandsAFolderInNameOrder() throws {
        let folder = try TestImages.emptyFolder()
        for name in ["IMG_2.HEIC", "IMG_1.jpg", "notes.txt"] {
            try Data().write(to: folder.appending(path: name))
        }
        let options = try Options.parse(["--out", "/tmp/out", folder.path])
        #expect(options.photos.map(\.lastPathComponent) == ["IMG_1.jpg", "IMG_2.HEIC"])
    }

    @Test func requiresAnOutputFolderAndPhotos() {
        #expect(throws: UsageError.self) { try Options.parse(["/tmp/a.heic"]) }
        #expect(throws: UsageError.self) { try Options.parse(["--out", "/tmp/out"]) }
        #expect(throws: UsageError.self) { try Options.parse(["--out"]) }
    }
}
