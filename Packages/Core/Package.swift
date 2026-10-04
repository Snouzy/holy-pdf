// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Core",
    platforms: [.macOS(.v15), .iOS(.v18)],
    products: [
        .library(name: "ScanCore", targets: ["ScanCore"]),
        .library(name: "PDFCore", targets: ["PDFCore"]),
        .library(name: "ScanSession", targets: ["ScanSession"]),
        .executable(name: "scan-cli", targets: ["ScanCLI"]),
    ],
    targets: [
        .target(name: "ScanCore"),
        .target(name: "PDFCore"),
        .target(name: "ScanSession", dependencies: ["ScanCore", "PDFCore"]),
        .executableTarget(name: "ScanCLI", dependencies: ["ScanCore", "PDFCore", "ScanSession"]),
        .target(name: "TestSupport", dependencies: ["ScanCore"], path: "Tests/TestSupport"),
        .testTarget(name: "ScanSessionTests", dependencies: ["ScanSession", "ScanCore", "PDFCore", "TestSupport"]),
        .testTarget(name: "ScanCoreTests", dependencies: ["ScanCore", "TestSupport"]),
        .testTarget(name: "PDFCoreTests", dependencies: ["PDFCore", "TestSupport"]),
        .testTarget(name: "ScanCLITests", dependencies: ["ScanCLI", "ScanCore", "PDFCore", "ScanSession", "TestSupport"]),
    ]
)
