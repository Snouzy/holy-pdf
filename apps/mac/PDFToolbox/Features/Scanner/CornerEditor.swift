import ScanCore
import SwiftUI

/// Only the outline follows a drag; the page renders again on release, so a drag stays under 16 ms a frame.
struct CornerEditor: View {
    static let space = "corner-editor"
    let photo: CGImage
    let quad: Quad
    var commit: (Quad) -> Void
    @State private var drag: (corner: Int, quad: Quad)?

    var body: some View {
        GeometryReader { geometry in
            let frame = ScreenGeometry.fit(CGSize(width: photo.width, height: photo.height), in: geometry.size)
            let shown = drag?.quad ?? quad
            ZStack(alignment: .topLeading) {
                Image(decorative: photo, scale: 1)
                    .resizable()
                    .frame(width: frame.width, height: frame.height)
                    .offset(x: frame.minX, y: frame.minY)
                ScreenGeometry.outline(shown, in: frame)
                    .stroke(Color.accentColor, lineWidth: 2)
                ForEach(0..<4, id: \.self) { corner in
                    handle(active: drag?.corner == corner)
                        .pointerStyle(drag == nil ? .grabIdle : .grabActive)
                        .position(ScreenGeometry.point(shown.corners[corner], in: frame))
                        .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.space))
                            .onChanged { value in
                                let grabbed = ScreenGeometry.point(quad.corners[corner], in: frame)
                                var corners = quad.corners
                                corners[corner] = ScreenGeometry.normalized(CGPoint(x: grabbed.x + value.translation.width, y: grabbed.y + value.translation.height), in: frame)
                                drag = (corner, Quad(corners: corners))
                            }
                            .onEnded { value in
                                if let drag, value.translation != .zero, drag.quad != quad { commit(drag.quad) }
                                withAnimation(.easeOut(duration: 0.2)) { drag = nil }
                            })
                }
                if let drag {
                    Loupe(photo: photo, frame: frame, quad: drag.quad, corner: drag.corner)
                }
            }
            .coordinateSpace(.named(Self.space))
            // A corner stops at the photo's edge while the pointer goes on: the grab stays shown off the handle.
            .contentShape(Rectangle())
            .pointerStyle(drag == nil ? nil : .grabActive)
        }
    }

    func handle(active: Bool) -> some View {
        Circle()
            .fill(active ? Color.accentColor : .white)
            .stroke(active ? Color.white : Color.accentColor, lineWidth: 3)
            .frame(width: 18, height: 18)
            .frame(width: 36, height: 36)
            .contentShape(Circle())
            .accessibilityLabel("Corner")
    }
}

struct Loupe: View {
    static let diameter = 132.0
    static let zoom = 3.0
    let photo: CGImage
    let frame: CGRect
    let quad: Quad
    let corner: Int

    var body: some View {
        let center = quad.corners[corner]
        let magnified = CGSize(width: frame.width * Self.zoom, height: frame.height * Self.zoom)
        let shift = CGSize(width: (0.5 - center.x) * magnified.width, height: (0.5 - center.y) * magnified.height)
        ZStack {
            Color(nsColor: .windowBackgroundColor)
            ZStack(alignment: .topLeading) {
                Image(decorative: photo, scale: 1)
                    .resizable()
                    .frame(width: magnified.width, height: magnified.height)
                ScreenGeometry.outline(quad, in: CGRect(origin: .zero, size: magnified))
                    .stroke(Color.accentColor, lineWidth: 2)
            }
            .frame(width: magnified.width, height: magnified.height)
            .offset(shift)
            Path { path in
                path.move(to: CGPoint(x: 0, y: Self.diameter / 2))
                path.addLine(to: CGPoint(x: Self.diameter, y: Self.diameter / 2))
                path.move(to: CGPoint(x: Self.diameter / 2, y: 0))
                path.addLine(to: CGPoint(x: Self.diameter / 2, y: Self.diameter))
            }
            .stroke(Color.accentColor, lineWidth: 1)
        }
        .frame(width: Self.diameter, height: Self.diameter)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(.white, lineWidth: 4))
        .overlay(Circle().strokeBorder(Color.accentColor, lineWidth: 2))
        .position(position(near: ScreenGeometry.point(center, in: frame)))
        .allowsHitTesting(false)
    }

    /// Up and to the left of the corner, or on the other side near an edge, so the pointer never hides it.
    func position(near point: CGPoint) -> CGPoint {
        let gap = Self.diameter / 2 + 24
        let x = point.x - gap < Self.diameter / 2 ? point.x + gap : point.x - gap
        let y = point.y - gap < Self.diameter / 2 ? point.y + gap : point.y - gap
        return CGPoint(x: x, y: y)
    }
}
