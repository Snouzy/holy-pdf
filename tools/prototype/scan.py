import json
import sys
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).parent
SRC = HERE / "src"
OUT = HERE / "out"
CHECK = HERE / "check"
DOWN = 4
A4_W = 1654


def load_quads():
    quads = {}
    for line in (HERE / "quads.txt").read_text().splitlines():
        parts = line.split()
        quads[parts[0].removesuffix(".jpg")] = np.array(parts[1:9], float).reshape(4, 2)
    overrides = HERE / "overrides.json"
    if overrides.exists():
        for name, pts in json.loads(overrides.read_text()).items():
            quads[name] = np.array(pts, float).reshape(4, 2)
    return quads


def fit_edge(gray, p0, p1, center, band):
    d = (p1 - p0) / np.linalg.norm(p1 - p0)
    n = np.array([-d[1], d[0]])
    if np.dot(n, (p0 + p1) / 2 - center) < 0:
        n = -n
    offsets = np.arange(-band, band + 1)
    pts = []
    for t in np.linspace(0.06, 0.94, 80):
        base = p0 + t * (p1 - p0)
        xy = base + offsets[:, None] * n
        prof = cv2.remap(gray, xy[:, 0].astype(np.float32)[None], xy[:, 1].astype(np.float32)[None],
                         cv2.INTER_LINEAR, borderValue=0)[0].astype(float)
        drop = prof[:-3] - prof[3:]
        if drop.max() > 12:
            # Bold text just inside the edge can drop more than the paper edge itself.
            i = int(np.flatnonzero(drop > 0.6 * drop.max())[-1])
            pts.append(xy[i + 1])
    pts = np.array(pts)
    keep = np.ones(len(pts), bool)
    for _ in range(4):
        vx, vy, x0, y0 = cv2.fitLine(pts[keep].astype(np.float32), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
        res = np.abs((pts[:, 0] - x0) * vy - (pts[:, 1] - y0) * vx)
        keep = res < max(1.5, 2.5 * np.median(res[keep]))
    return np.array([x0, y0]), np.array([vx, vy]), keep.mean()


def cross2(a, b):
    return a[0] * b[1] - a[1] * b[0]


def intersect(l1, l2):
    (p, r), (q, s) = l1, l2
    return p + cross2(q - p, s) / cross2(r, s) * r


def refine(img, quad):
    small = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(img, None, fx=1 / DOWN, fy=1 / DOWN,
                                                     interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY), (5, 5), 0)
    q = quad / DOWN
    center = q.mean(axis=0)
    band = int(0.03 * min(small.shape))
    lines, inliers = [], []
    for i in range(4):
        p, v, ok = fit_edge(small, q[i], q[(i + 1) % 4], center, band)
        lines.append((p, v))
        inliers.append(ok)
    corners = np.array([intersect(lines[i - 1], lines[i]) for i in range(4)])
    return corners * DOWN, inliers


def page_size(c, snap):
    w = (np.linalg.norm(c[1] - c[0]) + np.linalg.norm(c[2] - c[3])) / 2
    h = (np.linalg.norm(c[3] - c[0]) + np.linalg.norm(c[2] - c[1])) / 2
    ratio = max(w, h) / min(w, h)
    if snap and abs(ratio / np.sqrt(2) - 1) < 0.06:
        ratio = np.sqrt(2)
    short, long_ = A4_W, int(round(A4_W * ratio))
    return (short, long_) if h >= w else (long_, short)


def background(page, watermark):
    fine = cv2.dilate(page, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    if not watermark:
        return cv2.medianBlur(fine, 21)
    # The closing fills watermark strokes so they are not divided out. Inside shadows it also
    # fills narrow dark streaks between shadow lobes, so there we use the unclosed estimate.
    closed = cv2.morphologyEx(fine, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (91, 91)))
    gray = cv2.cvtColor(closed, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA)
    lit = cv2.dilate(small, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (101, 101)))
    lit = cv2.GaussianBlur(cv2.resize(lit, gray.shape[::-1]).astype(float), (0, 0), 40)
    gray = gray.astype(float)
    shade = cv2.GaussianBlur(np.clip((0.92 * lit - gray) / (0.1 * lit), 0, 1), (0, 0), 10)[..., None]
    return cv2.medianBlur((fine * shade + closed * (1 - shade)).astype(np.uint8), 21)


def enhance(page, mode, watermark):
    if mode == "photo":
        lo, hi = np.percentile(page, [0.5, 99.0], axis=(0, 1))
        out = (page.astype(float) - lo) / (hi - lo) * 255
        return np.clip(out, 0, 255).astype(np.uint8)
    norm = page.astype(float) / np.maximum(background(page, watermark).astype(float), 1)
    out = np.clip((norm - 0.12) / (0.86 - 0.12), 0, 1) ** 1.35 * 255
    out = out.astype(np.uint8)
    blur = cv2.GaussianBlur(out, (0, 0), 1.2)
    return cv2.addWeighted(out, 1.5, blur, -0.5, 0)


def main():
    cfg = json.loads((HERE / "pages.json").read_text())
    quads = load_quads()
    OUT.mkdir(exist_ok=True)
    CHECK.mkdir(exist_ok=True)
    only = set(sys.argv[1:])
    for name, opts in cfg.items():
        if only and name not in only:
            continue
        img = cv2.imread(str(SRC / f"{name}.jpg"))
        corners, inliers = refine(img, quads[name])
        dbg = img.copy()
        cv2.polylines(dbg, [quads[name].astype(np.int32)], True, (0, 0, 255), 12)
        cv2.polylines(dbg, [corners.astype(np.int32)], True, (0, 200, 0), 12)
        cv2.imwrite(str(CHECK / f"{name}.jpg"), cv2.resize(dbg, None, fx=0.2, fy=0.2))
        w, h = page_size(corners, opts.get("snap", True))
        dst = np.array([[0, 0], [w, 0], [w, h], [0, h]], np.float32)
        m = cv2.getPerspectiveTransform(corners.astype(np.float32), dst)
        page = cv2.warpPerspective(img, m, (w, h), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
        page = enhance(page, opts.get("mode", "doc"), opts.get("watermark", False))
        if opts.get("mode") != "photo":
            cv2.rectangle(page, (0, 0), (w - 1, h - 1), (255, 255, 255), 48)
        for poly in opts.get("whiten", []):
            pts = (np.array(poly, float).reshape(-1, 2) * [w, h]).astype(np.int32)
            cv2.fillPoly(page, [pts], (255, 255, 255))
        cv2.imwrite(str(OUT / f"{name}.jpg"), page, [cv2.IMWRITE_JPEG_QUALITY, 80])
        print(name, f"{w}x{h}", " ".join(f"{v:.0f}" for v in corners.ravel()))


if __name__ == "__main__":
    main()
