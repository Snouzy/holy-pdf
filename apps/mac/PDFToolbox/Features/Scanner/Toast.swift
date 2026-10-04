import AppKit
import SwiftUI

struct Toast: Equatable {
    enum Kind {
        case progress, success, error
    }

    let id = UUID()
    var kind: Kind
    var message: String
    var reveal: URL?
}

extension View {
    func toast(_ toast: Binding<Toast?>) -> some View {
        overlay(alignment: .bottom) {
            ZStack {
                if let shown = toast.wrappedValue {
                    ToastView(toast: shown) { toast.wrappedValue = nil }
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.easeOut(duration: 0.2), value: toast.wrappedValue)
        }
    }
}

private struct ToastView: View {
    let toast: Toast
    var dismiss: () -> Void
    @State private var hovering = false

    var body: some View {
        HStack(spacing: 12) {
            switch toast.kind {
            case .progress:
                MonkAvatar(mood: .focus, size: 30)
                ProgressView().controlSize(.small)
            case .success: MonkAvatar(mood: .joy, size: 30)
            case .error: MonkAvatar(mood: .oops, size: 30)
            }
            Text(toast.message)
            if let url = toast.reveal {
                Button("Show in Finder") {
                    NSWorkspace.shared.activateFileViewerSelecting([url])
                    dismiss()
                }
                .buttonStyle(.link)
                .buttonHover()
            }
            if toast.kind == .error {
                Button("Close", systemImage: "xmark", action: dismiss)
                    .labelStyle(.iconOnly)
                    .buttonStyle(.borderless)
                    .foregroundStyle(.secondary)
                    .help("Close")
                    .buttonHover()
            }
        }
        .font(.callout)
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(.separator))
        .shadow(color: .black.opacity(0.15), radius: 10, y: 3)
        .padding(.bottom, 14)
        .onHover { hovering = $0 }
        // The timer waits while the pointer is on the toast, so « Show in Finder » stays in reach.
        .task(id: hovering ? nil : toast.id) {
            guard !hovering, toast.kind == .success else { return }
            try? await Task.sleep(for: .seconds(4))
            if !Task.isCancelled { dismiss() }
        }
    }
}
