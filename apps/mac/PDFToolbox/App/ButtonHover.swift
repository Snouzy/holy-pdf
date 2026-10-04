import SwiftUI

extension View {
    func buttonHover() -> some View {
        modifier(ButtonHover())
    }
}

private struct ButtonHover: ViewModifier {
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hovering = false

    private var active: Bool { hovering && isEnabled }

    func body(content: Content) -> some View {
        content
            .brightness(active ? (colorScheme == .dark ? 0.10 : -0.07) : 0)
            .pointerStyle(isEnabled ? .link : nil)
            .onHover { hovering = isEnabled && $0 }
            .onChange(of: isEnabled) { if !isEnabled { hovering = false } }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: active)
    }
}
