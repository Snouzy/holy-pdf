import SwiftUI

struct PageStepper: View {
    let index: Int
    let count: Int
    var go: (Int) -> Void

    var body: some View {
        HStack {
            Button { go(index - 1) } label: {
                Label("Previous page", systemImage: "chevron.left").labelStyle(.iconOnly)
            }
            .buttonHover()
            .disabled(index == 0)
            Text("Page \(index + 1) of \(count)")
                .monospacedDigit().frame(minWidth: 120)
            Button { go(index + 1) } label: {
                Label("Next page", systemImage: "chevron.right").labelStyle(.iconOnly)
            }
            .buttonHover()
            .disabled(index + 1 >= count)
        }
        .padding(12)
    }
}

/// A number that the user types or steps.
struct NumberField: View {
    let title: LocalizedStringKey
    @Binding var value: Int
    let range: ClosedRange<Int>

    /// A field parses any number, down to the smallest an `Int` holds: the arithmetic behind the field would trap on it.
    static func typed(_ number: Int, in range: ClosedRange<Int>) -> Int {
        min(max(number, range.lowerBound), range.upperBound)
    }

    var body: some View {
        Stepper(value: $value, in: range) {
            HStack {
                Text(title)
                TextField(title, value: Binding(get: { value }, set: { value = Self.typed($0, in: range) }), format: .number.grouping(.never))
                    .labelsHidden().textFieldStyle(.roundedBorder).multilineTextAlignment(.trailing).frame(width: 64)
            }
        }
    }
}
