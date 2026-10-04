import Foundation

@main
struct ScanCLI {
    static func main() async {
        do {
            let options = try Options.parse(Array(CommandLine.arguments.dropFirst()))
            let edits = try options.editsFile.map(EditsFile.load) ?? [:]
            try FileManager.default.createDirectory(at: options.outputDirectory, withIntermediateDirectories: true)
            let report = try await BatchRunner().run(photos: options.photos, edits: edits, outputDirectory: options.outputDirectory)
            try report.write(to: options.outputDirectory.appending(path: "report.json"))
            print(report.summary)
        } catch let error as UsageError {
            FileHandle.standardError.write(Data((error.message + "\n").utf8))
            exit(64)
        } catch {
            FileHandle.standardError.write(Data("scan-cli: \(error)\n".utf8))
            exit(1)
        }
    }
}
