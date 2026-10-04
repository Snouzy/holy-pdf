import SwiftUI

/// The corner a placed signature or watermark is resized by.
struct ResizeHandle: View {
    var body: some View {
        Image(systemName: "arrow.up.left.and.arrow.down.right")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 22, height: 22)
            .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 4))
            .contentShape(Rectangle())
    }
}
