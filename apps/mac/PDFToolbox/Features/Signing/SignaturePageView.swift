import PDFCore
import SwiftUI

struct SignaturePageView: View {
    @Environment(SigningSession.self) private var session

    var body: some View {
        GeometryReader { geometry in
            if session.pageSizes.indices.contains(session.pageIndex) {
                let page = session.pageSizes[session.pageIndex]
                let scale = min(max(1, geometry.size.width - 48) / page.width, max(1, geometry.size.height - 48) / page.height)
                let size = CGSize(width: page.width * scale, height: page.height * scale)
                ZStack(alignment: .topLeading) {
                    Color.white
                    Group {
                        if let preview = session.preview {
                            Image(decorative: preview, scale: 1).resizable()
                        } else {
                            ProgressView()
                        }
                    }
                    .frame(width: size.width, height: size.height)
                    .contentShape(Rectangle())
                    .onTapGesture(coordinateSpace: .named("signaturePage")) { point in
                        session.pageTapped(at: CGPoint(x: point.x / size.width, y: point.y / size.height))
                    }
                    ForEach(session.placements.filter { $0.pageIndex == session.pageIndex }, id: \.id) { placement in
                        if let mark = session.mark(placement.mark) {
                            SignatureOverlay(
                                placement: placement, image: mark.preview, pageSize: size,
                                selected: session.selectedID == placement.id,
                                select: { session.select(placement.id) },
                                commit: { session.updatePlacement(id: placement.id, bounds: $0) }
                            )
                        }
                    }
                }
                .coordinateSpace(name: "signaturePage")
                .frame(width: size.width, height: size.height)
                .shadow(color: .black.opacity(0.12), radius: 5, y: 2)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color(nsColor: .underPageBackgroundColor))
    }
}

private struct SignatureOverlay: View {
    let placement: SignaturePlacement
    let image: CGImage
    let pageSize: CGSize
    let selected: Bool
    var select: () -> Void
    var commit: (CGRect) -> Void
    @State private var draft: CGRect?

    private var bounds: CGRect { draft ?? placement.bounds }

    var body: some View {
        Image(decorative: image, scale: 1)
            .resizable()
            .frame(width: bounds.width * pageSize.width, height: bounds.height * pageSize.height)
            .contentShape(Rectangle())
            .overlay(Rectangle().stroke(selected ? Color.accentColor : .clear, lineWidth: 2))
            .gesture(DragGesture(coordinateSpace: .named("signaturePage"))
                .onChanged { value in
                    select()
                    var moved = placement.bounds
                    moved.origin.x = min(max(0, moved.minX + value.translation.width / pageSize.width), 1 - moved.width)
                    moved.origin.y = min(max(0, moved.minY + value.translation.height / pageSize.height), 1 - moved.height)
                    draft = moved
                }
                .onEnded { _ in finish() })
            .onTapGesture { select() }
            .overlay(alignment: .bottomTrailing) {
                if selected {
                    ResizeHandle()
                        .gesture(DragGesture(coordinateSpace: .named("signaturePage"))
                            .onChanged { value in
                                let factor = 1 + value.translation.width / (placement.bounds.width * pageSize.width)
                                draft = resized(factor)
                            }
                            .onEnded { _ in finish() })
                        .accessibilityHidden(true)
                }
            }
            .position(x: bounds.midX * pageSize.width, y: bounds.midY * pageSize.height)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Placed signature")
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { select() }
            .accessibilityAction(named: "Move left") { move(x: -0.02, y: 0) }
            .accessibilityAction(named: "Move right") { move(x: 0.02, y: 0) }
            .accessibilityAction(named: "Move up") { move(x: 0, y: -0.02) }
            .accessibilityAction(named: "Move down") { move(x: 0, y: 0.02) }
            .accessibilityAction(named: "Make smaller") { select(); commit(resized(0.9)) }
            .accessibilityAction(named: "Make larger") { select(); commit(resized(1.1)) }
    }

    private func resized(_ factor: CGFloat) -> CGRect {
        let original = placement.bounds
        let maximum = min((1 - original.minX) / original.width, (1 - original.minY) / original.height)
        let minimum = 24 / max(original.width * pageSize.width, original.height * pageSize.height)
        let factor = min(max(minimum, factor), maximum)
        return CGRect(x: original.minX, y: original.minY, width: original.width * factor, height: original.height * factor)
    }

    private func move(x: CGFloat, y: CGFloat) {
        select()
        var moved = placement.bounds
        moved.origin.x = min(max(0, moved.minX + x), 1 - moved.width)
        moved.origin.y = min(max(0, moved.minY + y), 1 - moved.height)
        commit(moved)
    }

    private func finish() {
        if let draft { commit(draft) }
        draft = nil
    }
}
