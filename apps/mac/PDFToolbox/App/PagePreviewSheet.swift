import SwiftUI

struct PagePreviewSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let count: Int
    let rotation: (Int) -> Int
    let render: @MainActor (Int) async throws -> CGImage
    let message: (Error) -> String
    @State private var index: Int
    @State private var image: CGImage?
    @State private var error: String?

    init(title: String, count: Int, start: Int = 0, rotation: @escaping (Int) -> Int = { _ in 0 },
         render: @escaping @MainActor (Int) async throws -> CGImage, message: @escaping (Error) -> String) {
        self.title = title
        self.count = count
        self.rotation = rotation
        self.render = render
        self.message = message
        _index = State(initialValue: start)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(title).font(.headline).lineLimit(1).truncationMode(.middle)
                Spacer()
                Button("Close") { dismiss() }.keyboardShortcut(.cancelAction).buttonHover()
            }
            .padding(16)
            Divider()
            ZStack {
                Color(nsColor: .underPageBackgroundColor)
                if let image {
                    OrganizedPageImage(image: image, rotation: rotation(index)).padding(16)
                        .accessibilityLabel("Page \(index + 1) of \(count)")
                } else if let error {
                    ContentUnavailableView {
                        Label("Preview unavailable", systemImage: "doc.questionmark")
                    } description: { Text(error) }
                } else {
                    ProgressView("Loading preview…")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            Divider()
            HStack(spacing: 20) {
                Button { changePage(-1) } label: { Label("Previous page", systemImage: "chevron.left") }
                    .buttonHover().disabled(index == 0)
                Text("Page \(index + 1) of \(count)").monospacedDigit()
                    .frame(minWidth: 120)
                Button { changePage(1) } label: { Label("Next page", systemImage: "chevron.right") }
                    .buttonHover().disabled(index + 1 >= count)
            }
            .padding(16)
        }
        .frame(width: 760, height: 580)
        .task(id: index) {
            let requested = index
            image = nil
            error = nil
            do {
                let rendered = try await render(requested)
                guard !Task.isCancelled, requested == index else { return }
                image = rendered
            } catch {
                guard !Task.isCancelled, requested == index else { return }
                self.error = message(error)
            }
        }
        .onKeyPress(.leftArrow) { changePage(-1); return .handled }
        .onKeyPress(.rightArrow) { changePage(1); return .handled }
    }

    private func changePage(_ offset: Int) {
        let next = index + offset
        guard (0..<count).contains(next) else { return }
        image = nil
        error = nil
        index = next
    }
}
