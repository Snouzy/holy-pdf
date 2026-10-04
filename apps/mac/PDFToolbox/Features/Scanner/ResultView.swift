import ScanCore
import SwiftUI

/// A stroke stays painted until the render that includes it arrives, so the page never flashes back.
struct ResultView: View {
    let image: CGImage
    let erasing: Bool
    /// Brush diameter, in points on screen.
    let brush: Double
    var erase: (EraseMark) -> Void
    @State private var stroke: [CGPoint] = []
    @State private var waiting: [EraseMark] = []
    @State private var hover: CGPoint?

    var body: some View {
        GeometryReader { geometry in
            let frame = ScreenGeometry.fit(CGSize(width: image.width, height: image.height), in: geometry.size)
            ZStack(alignment: .topLeading) {
                Image(decorative: image, scale: 1)
                    .resizable()
                    .frame(width: frame.width, height: frame.height)
                    .offset(x: frame.minX, y: frame.minY)
                    .shadow(color: .black.opacity(0.12), radius: 8, y: 4)
                Canvas { context, _ in
                    for mark in waiting {
                        if case .stroke(let points, let radius) = mark {
                            paint(points.map { ScreenGeometry.point($0, in: frame) }, width: 2 * radius * frame.width, in: &context)
                        }
                    }
                    paint(stroke, width: brush, in: &context)
                    if erasing, let hover {
                        let ring = CGRect(x: hover.x - brush / 2, y: hover.y - brush / 2, width: brush, height: brush)
                        context.stroke(Path(ellipseIn: ring), with: .color(.orange), lineWidth: 1)
                    }
                }
                .allowsHitTesting(false)
            }
            .contentShape(Path(frame))
            .pointerStyle(erasing ? .rectSelection : nil)
            .gesture(DragGesture(minimumDistance: 0)
                .onChanged { value in
                    if stroke.first != value.startLocation { stroke = [value.startLocation] }
                    stroke.append(value.location)
                    // Hover events stop while the button is down: the ring follows the stroke.
                    hover = frame.contains(value.location) ? value.location : nil
                }
                .onEnded { _ in commit(in: frame) },
                including: erasing ? .all : .subviews)
            .onContinuousHover { phase in
                if erasing, case .active(let point) = phase { hover = point } else { hover = nil }
            }
        }
        .onChange(of: ObjectIdentifier(image)) { waiting = [] }
        .onChange(of: erasing) { _, isErasing in if !isErasing { stroke = [] } }
    }

    func paint(_ points: [CGPoint], width: Double, in context: inout GraphicsContext) {
        context.stroke(Path { $0.addLines(points) }, with: .color(.white),
                       style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round))
    }

    func commit(in frame: CGRect) {
        defer { stroke = [] }
        guard !stroke.isEmpty, frame.width > 0 else { return }
        let mark = EraseMark.stroke(points: stroke.map { ScreenGeometry.normalized($0, in: frame) }, radius: brush / 2 / frame.width)
        waiting.append(mark)
        erase(mark)
    }
}
