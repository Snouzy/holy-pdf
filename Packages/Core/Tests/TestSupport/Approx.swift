import ScanCore

public func isClose(_ a: Double, _ b: Double, tolerance: Double = 1e-9) -> Bool {
    abs(a - b) <= tolerance
}

public func isClose(_ a: NormalizedPoint, _ b: NormalizedPoint, tolerance: Double = 1e-9) -> Bool {
    isClose(a.x, b.x, tolerance: tolerance) && isClose(a.y, b.y, tolerance: tolerance)
}
