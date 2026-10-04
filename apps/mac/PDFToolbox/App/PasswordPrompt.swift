import SwiftUI

struct PasswordPrompt: View {
    let name: String
    var passwordNote = true
    var unlock: (String) -> Void
    @State private var password = ""

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "lock.doc").font(.system(size: 42)).foregroundStyle(.secondary).accessibilityHidden(true)
            Text("This PDF needs a password").font(.title2)
            Text(name).lineLimit(2)
            SecureField("PDF password", text: $password)
                .textFieldStyle(.roundedBorder).frame(width: 280)
                .onSubmit(submit)
            Button("Unlock PDF", action: submit).buttonStyle(.borderedProminent)
                .buttonHover()
                .disabled(password.isEmpty)
            if passwordNote {
                Text("The saved copy will not require a password.").font(.callout).foregroundStyle(.secondary)
            }
        }
        .padding(30)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func submit() {
        guard !password.isEmpty else { return }
        unlock(password)
        password = ""
    }
}
