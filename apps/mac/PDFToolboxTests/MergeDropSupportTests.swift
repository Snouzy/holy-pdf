import AppKit
import Testing
import UniformTypeIdentifiers
@testable import PDFToolbox

@MainActor
struct MergeDropSupportTests {
    @Test func topAndBottomHalvesHaveDifferentInsertionPointsAndBlankSpaceMeansEnd() {
        let id = UUID()
        #expect(MergeDropSupport.position(rowID: id, rowHeight: 100, location: CGPoint(x: 10, y: 20)) == .before(id))
        #expect(MergeDropSupport.position(rowID: id, rowHeight: 100, location: CGPoint(x: 10, y: 80)) == .after(id))
        #expect(MergeDropSupport.position(rowID: nil, rowHeight: 0, location: .zero) == .end)
    }

    @Test func finderURLsPreserveSpacesAndUnicodeAndRejectRemoteOrNonPDFs() {
        let url = URL(fileURLWithPath: "/tmp/Dossier été/Carte parent.PDF")
        #expect(MergeDropSupport.pdfURL(from: url as NSURL) == url)
        #expect(MergeDropSupport.pdfURL(from: url.dataRepresentation as NSData) == url)
        #expect(MergeDropSupport.pdfURL(from: url.absoluteString as NSString) == url)
        #expect(MergeDropSupport.pdfURL(from: "https://example.com/private.pdf" as NSString) == nil)
        #expect(MergeDropSupport.pdfURL(from: URL(fileURLWithPath: "/tmp/photo.jpg") as NSURL) == nil)
    }

    @Test func fileProvidersAreReadInDropOrderAndDeliveredAsOneBatch() async {
        let urls = [URL(fileURLWithPath: "/tmp/third.pdf"), URL(fileURLWithPath: "/tmp/first.pdf")]
        let providers = urls.map { NSItemProvider(object: $0 as NSURL) }
        var received: [[URL]] = []
        let delegate = MergeDropDelegate(isEnabled: { true }, onFiles: { received.append($0) },
                                         onTarget: { _ in })
        let accepted = await delegate.receive(providers: providers)
        #expect(accepted)
        #expect(received == [urls])
    }

    @Test func rowPayloadRoundTripsAndRejectsUnrelatedText() {
        let id = UUID()
        #expect(MergeDropSupport.decodeID(MergeDropSupport.payload(for: id)) == id)
        #expect(MergeDropSupport.decodeID(id.uuidString) == nil)
        #expect(MergeDropSupport.decodeID("ordinary text") == nil)
        #expect(MergeDropSupport.decodeID("holy-pdf-merge:invalid") == nil)
    }

    @Test func busyViewRejectsFilesWithoutMutations() async {
        let delegate = MergeDropDelegate(isEnabled: { false }, onFiles: { _ in Issue.record("Busy import") },
                                         onTarget: { _ in })
        let file = NSItemProvider(object: URL(fileURLWithPath: "/tmp/source.pdf") as NSURL)
        #expect(await delegate.receive(providers: [file]) == false)
    }

    @Test func becomingBusyWhileAProviderLoadsAlsoRejectsTheDrop() async {
        let availability = DropAvailability()
        let provider = NSItemProvider()
        let data = URL(fileURLWithPath: "/tmp/source.pdf").dataRepresentation
        provider.registerDataRepresentation(forTypeIdentifier: UTType.fileURL.identifier, visibility: .all) { completion in
            Task { @MainActor in
                availability.enabled = false
                completion(data, nil)
            }
            return nil
        }
        let delegate = MergeDropDelegate(isEnabled: { availability.enabled },
                                         onFiles: { _ in Issue.record("Drop completed while busy") },
                                         onTarget: { _ in })
        let accepted = await delegate.receive(providers: [provider])
        #expect(!accepted)
    }
}

@MainActor
private final class DropAvailability {
    var enabled = true
}
