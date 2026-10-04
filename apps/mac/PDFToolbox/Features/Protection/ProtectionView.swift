import SwiftUI

struct ProtectionView: View {
    @Bindable var session: ProtectionSession

    var body: some View {
        switch session.mode {
        case .protect:
            CopyToolView(file: session.file, tool: .protect,
                         startTitle: "A password on your PDF",
                         startHint: "Drop a PDF here, then choose its password.",
                         saveTitle: "Save a protected copy…", savedTitle: "Protected copy saved",
                         canSave: session.canSave, passwordNote: false, save: session.export) { newPassword }
        case .unlock:
            CopyToolView(file: session.file, tool: .unlock,
                         startTitle: "A PDF without its password",
                         startHint: "Drop a protected PDF here. You need its password to open it.",
                         saveTitle: "Save an unlocked copy…", savedTitle: "Unlocked copy saved",
                         canSave: session.canSave, passwordNote: false, save: session.export) { unlocking }
        }
    }

    @ViewBuilder private var newPassword: some View {
        SecureField("Password", text: $session.password).textFieldStyle(.roundedBorder)
        SecureField("Confirm the password", text: $session.confirmation).textFieldStyle(.roundedBorder)
            .onSubmit(session.export)
        if session.passwordIsRefused {
            Label("Use 1 to 32 characters: letters without accents, digits and signs such as - _ @ # &. No € or §.", systemImage: "exclamationmark.triangle")
                .font(.callout).foregroundStyle(.red)
        } else if session.confirmationDiffers {
            Label("The two passwords are different.", systemImage: "exclamationmark.triangle").font(.callout).foregroundStyle(.red)
        }
        Label("Keep this password: without it, nobody can open the copy, not even you.", systemImage: "key")
            .font(.callout).foregroundStyle(.secondary)
        Text("The copy is encrypted in AES-128. A long password protects it better.").font(.callout).foregroundStyle(.secondary)
        if session.file.isEncrypted {
            Label("The new password replaces the one of the original.", systemImage: "arrow.triangle.2.circlepath")
                .font(.callout).foregroundStyle(.secondary)
        }
    }

    @ViewBuilder private var unlocking: some View {
        if session.canSave {
            Label("The copy will open without a password, with no limit on printing or copying.", systemImage: "lock.open")
        } else {
            Label("This PDF has no password: there is nothing to unlock.", systemImage: "checkmark.circle")
        }
    }
}
