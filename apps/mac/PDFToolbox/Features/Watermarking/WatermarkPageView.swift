import PDFCore
import SwiftUI

struct WatermarkPageView: View {
    @Environment(WatermarkSession.self) private var session

    var body: some View {
        GeometryReader { geometry in
            if session.pageSizes.indices.contains(session.pageIndex) {
                let page = session.pageSizes[session.pageIndex]
                let scale = min(max(1, geometry.size.width - 48) / page.width, max(1, geometry.size.height - 48) / page.height)
                let size = CGSize(width: page.width * scale, height: page.height * scale)
                ZStack(alignment: .topLeading) {
                    Color.white
                    if let preview = session.preview {
                        Image(decorative: preview, scale: 1).resizable().frame(width: size.width, height: size.height)
                    } else {
                        ProgressView().frame(width: size.width, height: size.height)
                    }
                    ForEach(session.layout.marks) { settings in
                        if let mark = session.watermark(of: settings), mark.pages.contains(session.pageIndex), let overlay = session.overlay(for: settings) {
                            WatermarkOverlay(mark: mark, image: overlay, pageSize: size, selected: settings.id == session.settings.id,
                                             select: { session.select(settings.id) }) { center, width in
                                session.select(settings.id)
                                session.update {
                                    if let center { $0.center = center }
                                    if let width { $0.width = width }
                                }
                            }
                        }
                    }
                }
                .coordinateSpace(name: "watermarkPage")
                .frame(width: size.width, height: size.height)
                .clipped()
                .shadow(color: .black.opacity(0.12), radius: 5, y: 2)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color(nsColor: .underPageBackgroundColor))
    }
}

private struct WatermarkOverlay: View {
    let mark: Watermark
    let image: CGImage
    let pageSize: CGSize
    let selected: Bool
    var select: () -> Void
    var commit: (CGPoint?, CGFloat?) -> Void
    @State private var center: CGPoint?
    @State private var width: CGFloat?

    private var shown: Watermark {
        var shown = mark
        if let center { shown.center = center }
        if let width { shown.width = width }
        return shown
    }

    var body: some View {
        let box = shown.boundingSize(pageWidth: pageSize.width)
        Image(decorative: image, scale: 1)
            .resizable()
            .frame(width: box.width, height: box.height)
            .contentShape(Rectangle())
            .overlay(Rectangle().stroke(Color.accentColor.opacity(selected ? 1 : 0.5), style: StrokeStyle(lineWidth: selected ? 2 : 1, dash: [4, 3])))
            .onTapGesture { select() }
            .gesture(DragGesture(coordinateSpace: .named("watermarkPage"))
                .onChanged { value in
                    select()
                    center = CGPoint(x: min(max(mark.center.x + value.translation.width / pageSize.width, 0), 1),
                                     y: min(max(mark.center.y + value.translation.height / pageSize.height, 0), 1))
                }
                .onEnded { _ in
                    commit(center, nil)
                    center = nil
                })
            .overlay(alignment: .bottomTrailing) {
                if selected {
                    ResizeHandle()
                        .gesture(DragGesture(coordinateSpace: .named("watermarkPage"))
                            .onChanged { value in width = mark.widthAfterCornerDrag(value.translation, pageWidth: pageSize.width) }
                            .onEnded { _ in
                                commit(nil, width)
                                width = nil
                            })
                        .accessibilityHidden(true)
                }
            }
            .position(x: shown.center.x * pageSize.width, y: shown.center.y * pageSize.height)
            .accessibilityLabel("Placed watermark")
    }
}
