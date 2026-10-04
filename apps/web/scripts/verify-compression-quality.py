"""Sample original vs delivered PDF pages locally; SSIM is diagnostic, not a conformance certificate."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pymupdf
import skimage
from PIL import Image, ImageChops, ImageEnhance
from skimage.metrics import structural_similarity

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--original", type=Path, default=Path("fixtures-private/compress"))
parser.add_argument("--candidate", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)


def metrics(a, b):
    if np.array_equal(a, b):
        return {"ssim": 1.0, "meanAbsoluteChannelError": 0.0, "changedPixelFraction": 0.0}
    score = float(structural_similarity(a, b, channel_axis=2, data_range=255, gaussian_weights=True, sigma=1.5, use_sample_covariance=False))
    delta = np.abs(a.astype(np.int16) - b.astype(np.int16))
    return {"ssim": score, "meanAbsoluteChannelError": float(delta.mean()), "changedPixelFraction": float(np.any(delta, axis=2).mean())}


def montage(a, b, path):
    original_image, result_image = Image.fromarray(a), Image.fromarray(b)
    difference = ImageEnhance.Brightness(ImageChops.difference(original_image, result_image)).enhance(4)
    images = [original_image, result_image, difference]
    for image in images:
        image.thumbnail((500, 700))
    canvas = Image.new("RGB", (sum(image.width for image in images), max(image.height for image in images)), "white")
    x = 0
    for image in images:
        canvas.paste(image, (x, 0))
        x += image.width
    canvas.save(path)


def render(page, scale):
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csRGB, alpha=False, annots=True)
    return pixmap, np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.height, pixmap.width, 3)


def largest_image_crop(page, image_info, pixmap, scale):
    """Image placement coordinates are unrotated; rendered page coordinates include rotation.

    Intersect the placement with the page bounds. This is a rectangular diagnostic crop,
    not a reconstruction of arbitrary clipping paths, masks or occlusion by later content.
    """
    rectangles = []
    for image in image_info:
        if image.get("bpc", 8) <= 1:
            continue
        rect = (pymupdf.Rect(image["bbox"]) * page.rotation_matrix) & page.rect
        if not rect.is_empty and not rect.is_infinite:
            rectangles.append(rect)
    if not rectangles:
        return None
    rect = max(rectangles, key=lambda value: value.get_area())
    x0 = max(0, math.floor(rect.x0 * scale) - pixmap.x)
    y0 = max(0, math.floor(rect.y0 * scale) - pixmap.y)
    x1 = min(pixmap.width, math.ceil(rect.x1 * scale) - pixmap.x)
    y1 = min(pixmap.height, math.ceil(rect.y1 * scale) - pixmap.y)
    if min(x1 - x0, y1 - y0) < 11:
        return None
    return {"pixelRect": [x0, y0, x1, y1], "rotatedPageRectPoints": list(rect)}


report = {
    "pymupdf": pymupdf.version[0], "numpy": np.__version__, "skimage": skimage.__version__,
    "protocol": "First, middle, last and most placed raster pixels page (deduplicated); render RGB opaque at up to 144 dpi, capped at 4 million pixels; SSIM gaussian weights sigma1.5 population covariance, RGB mean. Largest visible image placement crop is scored separately with page rotation applied.",
    "limitations": [
        "Diagnostic scores only; no quality threshold or conformance certification is inferred.",
        "Image crops intersect placement bounds with page bounds; arbitrary clipping paths, masks and occlusions are not reconstructed.",
        "Only sampled pages and one desktop renderer are assessed; small text and colour fidelity still require visual inspection.",
        "Delivered outputs may be originals due to the app's fallback; exact equality then describes delivery, not a compressed candidate.",
    ],
    "original": str(args.original), "candidate": str(args.candidate), "files": [], "rows": [],
}
sources = sorted(args.original.glob("*.pdf"))
if not sources:
    raise RuntimeError("No original PDFs found")
for number, source in enumerate(sources, 1):
    candidate = args.candidate / source.name
    if not candidate.exists():
        raise RuntimeError(f"Missing candidate {source.name}")
    report["files"].append({"pdf": number, "name": source.name, "originalSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "candidateSha256": hashlib.sha256(candidate.read_bytes()).hexdigest()})
    with pymupdf.open(source) as original, pymupdf.open(candidate) as result:
        if len(original) != len(result):
            raise RuntimeError("Page count mismatch")
        placements = [page.get_image_info(hashes=False, xrefs=False) for page in original]
        raster = [sum(image["width"] * image["height"] for image in images if image.get("bpc", 8) > 1) for images in placements]
        pages = sorted({0, len(original) // 2, len(original) - 1, max(range(len(original)), key=lambda i: raster[i])})
        for index in pages:
            before_page = original[index]
            scale = min(2, math.sqrt(4_000_000 / (before_page.rect.width * before_page.rect.height)))
            before, a = render(before_page, scale)
            after, b = render(result[index], scale)
            if (before.width, before.height) != (after.width, after.height):
                raise RuntimeError("Rendered geometry mismatch")
            row = {"pdf": number, "page": index + 1, "width": before.width, "height": before.height, "scale": scale, "effectiveDpi": scale * 72, **metrics(a, b)}
            crop = largest_image_crop(before_page, placements[index], before, scale)
            if crop:
                x0, y0, x1, y1 = crop["pixelRect"]
                ca, cb = a[y0:y1, x0:x1], b[y0:y1, x0:x1]
                row["largestImageCrop"] = {**crop, **metrics(ca, cb)}
                montage(ca, cb, args.output / f"pdf-{number:02}-page-{index + 1}-image.png")
            report["rows"].append(row)
            montage(a, b, args.output / f"pdf-{number:02}-page-{index + 1}.png")
            crop_note = f", largest image {row['largestImageCrop']['ssim']:.5f}" if crop else ""
            print(f"PDF {number:02} page {index + 1}: SSIM {row['ssim']:.5f}{crop_note}", flush=True)
        (args.output / "quality.json").write_text(json.dumps(report, indent=2))
scores = [row["ssim"] for row in report["rows"]]
report["summary"] = {"sampledPages": len(scores), "minimumSsim": min(scores), "medianSsim": float(np.median(scores)), "meanSsim": float(np.mean(scores))}
crop_scores = [row["largestImageCrop"]["ssim"] for row in report["rows"] if "largestImageCrop" in row]
report["summary"]["largestImageCrops"] = {"count": len(crop_scores), "minimumSsim": min(crop_scores) if crop_scores else None, "medianSsim": float(np.median(crop_scores)) if crop_scores else None}
report["worstArtifacts"] = []
worst = sorted(report["rows"], key=lambda row: min(row["ssim"], row.get("largestImageCrop", {}).get("ssim", 1)))[:5]
for rank, row in enumerate(worst, 1):
    source = sources[row["pdf"] - 1]
    with pymupdf.open(source) as original, pymupdf.open(args.candidate / source.name) as result:
        _, a = render(original[row["page"] - 1], row["scale"])
        _, b = render(result[row["page"] - 1], row["scale"])
        prefix = f"worst-{rank}-pdf-{row['pdf']:02}-page-{row['page']}"
        files = []
        for label, pixels in [("original", a), ("candidate", b)]:
            name = f"{prefix}-{label}.png"
            Image.fromarray(pixels).save(args.output / name)
            files.append(name)
        report["worstArtifacts"].append({"pdf": row["pdf"], "page": row["page"], "ssim": row["ssim"], "cropSsim": row.get("largestImageCrop", {}).get("ssim"), "images": files})
(args.output / "quality.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report["summary"], indent=2))
