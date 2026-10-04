import Foundation
import PDFCore
import PDFKit
import Testing
@testable import PDFToolbox

@MainActor
struct EditSessionTests {
    private func opened() async throws -> (session: EditSession, folder: URL) {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("Contrat.pdf")
        try demoPDF(title: "Contrat", pages: 2, color: 0).write(to: source)
        let session = EditSession()
        session.file.open(source)
        try await waitUntil { session.file.state == .ready }
        return (session, folder)
    }

    @Test func shapesLinesAndInkTakeTheCurrentStyle() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.choose(.rectangle)
        session.restyle { $0.color = .red; $0.thickness = .thick }
        session.addShape(in: CGRect(x: 0.5, y: 0.5, width: -0.2, height: -0.1))
        let box = try #require(session.items.first)
        #expect(box.content == .rectangle(EditShapeStyle(color: .red, filled: false, thickness: .thick)))
        #expect(abs(box.frame.minX - 0.3) < 1e-9 && abs(box.frame.minY - 0.4) < 1e-9, "A drag up and to the left still gives a box")
        #expect(session.tool == .select && session.selectedID == box.id && session.file.hasUnsavedEdits)
        session.choose(.arrow)
        session.addLine(from: CGPoint(x: 0.1, y: 0.1), to: CGPoint(x: 0.3, y: 0.2))
        #expect(session.items.last?.content == .line(EditStroke(color: .red, thickness: .thick), arrow: true))
        session.choose(.pen)
        session.addInk([CGPoint(x: 0.1, y: 0.1)])
        #expect(session.items.count == 2, "A click of the pen leaves nothing")
        session.addInk([CGPoint(x: 0.1, y: 0.1), CGPoint(x: 0.2, y: 0.15), CGPoint(x: 0.3, y: 0.1)])
        session.addInk([CGPoint(x: 0.1, y: 0.3), CGPoint(x: 0.2, y: 0.35)])
        #expect(session.items.count == 4 && session.tool == .pen && session.selectedID == nil, "The pen stays in the hand")
        session.choose(.highlighter)
        #expect(session.style.color == .red, "A colour the text shows through keeps")
        session.restyle { $0.color = .black }
        session.choose(.highlighter)
        #expect(session.style.color == .yellow, "Black would hide the text: the highlighter takes yellow")
        session.escape()
        #expect(session.tool == .select)
    }

    @Test func typingIsOneStepAndAnEmptyTextGoesAway() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.choose(.text)
        session.beginText(at: CGPoint(x: 0.1, y: 0.2))
        for typed in ["B", "Bo", "Bonjour\nà tous"] { session.typeText(typed) }
        #expect(session.items.isEmpty, "Nothing joins the page while the user types")
        let draft = try #require(session.draft)
        #expect(draft.frame.width > 0 && abs(draft.frame.height * 842 - 2 * EditPainter.lineHeight(EditTextStyle())) < 0.01)
        session.commitText()
        let text = try #require(session.items.first)
        #expect(text.content == .text("Bonjour\nà tous", EditTextStyle()) && session.tool == .select && session.selectedID == text.id)
        session.undo()
        #expect(session.items.isEmpty && !session.canUndo)
        session.redo()
        #expect(session.items == [text])
        session.editText(text.id)
        session.commitText()
        session.undo()
        #expect(session.items.isEmpty, "Opening the text and leaving it unchanged added no step")
        session.redo()
        session.editText(text.id)
        session.typeText("  ")
        session.commitText()
        #expect(session.items.isEmpty, "An emptied text goes away")
        session.undo()
        #expect(session.items == [text])
        session.choose(.text)
        session.beginText(at: CGPoint(x: 0.5, y: 0.5))
        session.commitText()
        #expect(session.items == [text] && session.tool == .text, "A click of the text tool without typing leaves nothing")
    }

    @Test func movingNudgingOrderingAndDeletingAreOneStepEach() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.choose(.rectangle)
        session.addShape(in: CGRect(x: 0.1, y: 0.1, width: 0.2, height: 0.2))
        session.choose(.ellipse)
        session.addShape(in: CGRect(x: 0.2, y: 0.2, width: 0.2, height: 0.2))
        let (box, ring) = (session.items[0], session.items[1])
        session.select(box.id)
        session.nudge(dx: 10, dy: 0)
        #expect(abs(session.items[0].frame.minX - (0.1 + 10.0 / 595)) < 1e-9)
        session.nudge(dx: -1000, dy: 0)
        #expect(session.items[0].frame.minX == 0, "An addition stays on the page")
        session.moveSelected(toFront: true)
        #expect(session.items.map(\.id) == [ring.id, box.id])
        session.moveSelected(toFront: true)
        session.replace(session.moved(session.items[1], by: CGSize(width: 0.05, height: 0.05)))
        session.deleteSelected()
        #expect(session.items.map(\.id) == [ring.id] && session.selectedID == nil)
        var steps = 0
        while session.canUndo {
            session.undo()
            steps += 1
        }
        #expect(steps == 7, "Two additions, two nudges, one reorder, one move, one deletion; a reorder that changes nothing is no step")
        #expect(!session.file.hasUnsavedEdits, "Nothing is left to lose")
    }

    @Test func theStyleFollowsTheSelectionAndChangesIt() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.choose(.text)
        session.restyle { $0.size = 30; $0.color = .blue; $0.font = .courier }
        session.beginText(at: CGPoint(x: 0.1, y: 0.1))
        session.typeText("Bleu")
        session.commitText()
        let text = try #require(session.items.first)
        session.choose(.rectangle)
        session.restyle { $0.color = .green }
        session.addShape(in: CGRect(x: 0.4, y: 0.4, width: 0.2, height: 0.1))
        session.select(text.id)
        #expect(session.style.color == .blue && session.style.size == 30 && session.style.font == .courier, "The panel shows the chosen text's style")
        #expect(session.styleKind == .text)
        session.restyle { $0.bold = true }
        let bold = try #require(session.items.first)
        #expect(bold.content == .text("Bleu", EditTextStyle(font: .courier, bold: true, size: 30, color: .blue)))
        #expect(session.items[1].content == .rectangle(EditShapeStyle(color: .green)), "The other addition keeps its style")
        session.undo()
        #expect(session.items.first == text)
        #expect(!session.style.bold, "After an undo, the panel shows the style the text has again")
        session.restyle { $0.size = 500 }
        #expect(session.style.size == 96)
    }

    @Test func picturesArriveUprightAndTurnFlipAndCrop() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let file = try pictureFile("photo.jpg", in: folder, width: 400, height: 200)
        session.choose(.pen)
        session.addImage(from: file)
        try await waitUntil { session.items.count == 1 }
        let placed = try #require(session.selected)
        #expect(session.tool == .select, "After a picture, the arrow comes back")
        guard case .picture = placed.content else {
            Issue.record("Not a picture: \(placed.content)")
            return
        }
        let points = CGSize(width: placed.frame.width * 595, height: placed.frame.height * 842)
        #expect(abs(points.width - 2 * points.height) < 0.5 && abs(placed.frame.midX - 0.5) < 1e-9, "Its shape, in the middle of the page")
        session.addImage(from: file, at: CGPoint(x: 0.95, y: 0.95))
        try await waitUntil { session.items.count == 2 }
        #expect(session.images.count == 1, "The same picture twice is kept once")
        #expect(abs(session.items[1].frame.maxX - 1) < 1e-9 && abs(session.items[1].frame.maxY - 1) < 1e-9, "Dropped near the corner, it stays on the page")
        session.select(placed.id)
        session.turnSelected()
        let turned = try #require(session.selected)
        #expect(abs(turned.frame.width * 595 - points.height) < 0.5 && abs(turned.frame.height * 842 - points.width) < 0.5)
        #expect(abs(turned.frame.midX - placed.frame.midX) < 1e-9 && abs(turned.frame.midY - placed.frame.midY) < 1e-9)
        session.flipSelected(horizontally: true)
        session.undo()
        session.undo()
        #expect(session.selected == placed)
        session.toggleCropping()
        #expect(session.isCropping)
        let left = CGRect(x: placed.frame.minX, y: placed.frame.minY, width: placed.frame.width / 2, height: placed.frame.height)
        session.replace(try #require(session.cropped(placed, to: left)))
        let cropped = try #require(session.selected)
        guard case .picture(let cut) = cropped.content else {
            Issue.record("Not a picture: \(cropped.content)")
            return
        }
        #expect(abs(cut.crop.width - 0.5) < 1e-9 && cut.crop.minX == 0)
        let whole = try #require(session.uncroppedFrame(of: cropped))
        #expect(abs(whole.width - placed.frame.width) < 1e-9 && abs(whole.minX - placed.frame.minX) < 1e-9)
        #expect(session.screenPicture(of: cropped)?.width == 200)
        session.select(nil)
        #expect(!session.isCropping)
    }

    @Test func aLatePictureNeverLandsOnAnotherPDF() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        let notes = folder.appendingPathComponent("notes.png")
        try Data("not a picture".utf8).write(to: notes)
        session.addImage(from: notes)
        try await waitUntil { session.file.errorMessage != nil }
        #expect(session.items.isEmpty && !session.isLoadingImage)
        let other = folder.appendingPathComponent("Autre.pdf")
        try demoPDF(title: "Autre", pages: 1, color: 1).write(to: other)
        session.choose(.rectangle)
        session.addShape(in: CGRect(x: 0.1, y: 0.1, width: 0.2, height: 0.2))
        session.addImage(from: try pictureFile("photo.jpg", in: folder, width: 400, height: 200))
        session.file.open(other)
        try await waitUntil { session.file.state == .ready }
        try await Task.sleep(for: .milliseconds(300))
        #expect(session.items.isEmpty && session.images.isEmpty && !session.canUndo && session.tool == .select)
    }

    @Test func savingWhileTypingKeepsTheTypedText() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.choose(.text)
        session.beginText(at: CGPoint(x: 0.1, y: 0.3))
        session.typeText("Lu et approuvé")
        #expect(session.canSave)
        let target = folder.appendingPathComponent("Contrat-modifié.pdf")
        await session.saveCopy(to: target)
        let copy = try #require(PDFDocument(url: target))
        #expect(copy.page(at: 0)?.string?.contains("Lu et approuvé") == true)
        #expect(session.draft == nil && !session.file.hasUnsavedEdits && session.file.lastSavedURL == target)
    }

    @Test func aDeletedTextStaysDeletedAndTypingIsAChange() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.choose(.text)
        session.beginText(at: CGPoint(x: 0.1, y: 0.2))
        session.typeText("Brouillon")
        #expect(session.file.hasUnsavedEdits, "A text being typed is a change one can lose")
        session.commitText()
        let text = try #require(session.items.first)
        session.editText(text.id)
        session.deleteSelected()
        session.commitText()
        #expect(session.items.isEmpty, "Delete with the field open removes the text for good")
    }

    @Test func aTurnKeepsThePictureOnThePage() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.addImage(from: try pictureFile("photo.jpg", in: folder, width: 400, height: 200), at: CGPoint(x: 0.5, y: 0.02))
        try await waitUntil { session.items.count == 1 }
        session.turnSelected()
        let turned = try #require(session.selected)
        #expect(turned.frame.minX >= 0 && turned.frame.minY >= 0 && turned.frame.maxX <= 1 + 1e-9 && turned.frame.maxY <= 1 + 1e-9, "\(turned.frame)")
    }

    @Test func undoAndRedoWalkAHundredSteps() async throws {
        let (session, folder) = try await opened()
        defer { try? FileManager.default.removeItem(at: folder) }
        session.choose(.pen)
        for step in 0..<150 { session.addInk([CGPoint(x: 0.001 * Double(step), y: 0.1), CGPoint(x: 0.2, y: 0.2)]) }
        var steps = 0
        while session.canUndo {
            session.undo()
            steps += 1
        }
        #expect(steps == 100 && session.items.count == 50)
        session.redo()
        session.redo()
        #expect(session.items.count == 52 && session.canRedo)
        session.addInk([CGPoint(x: 0.5, y: 0.5), CGPoint(x: 0.6, y: 0.6)])
        #expect(!session.canRedo, "A new change clears what redo would bring back")
    }
}
