"""Compare rendered pixels before/after a structural PDF rewrite, without JPEG changes.

Run in an isolated environment with PyMuPDF installed, after timing benchmarks finish:
  python apps/web/scripts/verify-compression-render.py \
    --pair LABEL REFERENCE_DIRECTORY CANDIDATE_DIRECTORY
Repeat --pair for additional engines or input cohorts. Reports and optional mismatch
images go to the ignored private corpus directory. No files are uploaded.
"""

import argparse
import hashlib
import json
import platform
from pathlib import Path

import pymupdf


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUTPUT = ROOT / "fixtures-private/compress/runs/benchmark-render"


def compare_page(reference, candidate, page_number, dpi, mismatch_prefix):
    before = reference[page_number].get_pixmap(dpi=dpi, colorspace=pymupdf.csRGB, alpha=False, annots=True)
    after = candidate[page_number].get_pixmap(dpi=dpi, colorspace=pymupdf.csRGB, alpha=False, annots=True)
    a, b = before.samples, after.samples
    geometry_equal = (before.width, before.height, before.n) == (after.width, after.height, after.n)
    identical = geometry_equal and a == b
    result = {
        "page": page_number + 1,
        "referenceGeometry": [before.width, before.height, before.n],
        "candidateGeometry": [after.width, after.height, after.n],
        "referenceSha256": hashlib.sha256(a).hexdigest(),
        "candidateSha256": hashlib.sha256(b).hexdigest(),
        "identical": identical,
    }
    if geometry_equal and not identical:
        differing_channels = 0
        absolute_difference = 0
        maximum_difference = 0
        for left, right in zip(a, b):
            difference = abs(left - right)
            differing_channels += difference != 0
            absolute_difference += difference
            maximum_difference = max(maximum_difference, difference)
        result.update({
            "differingChannels": differing_channels,
            "totalChannels": len(a),
            "meanAbsoluteChannelDifference": absolute_difference / len(a),
            "maximumChannelDifference": maximum_difference,
        })
    if not identical and mismatch_prefix is not None:
        mismatch_prefix.parent.mkdir(parents=True, exist_ok=True)
        before.save(str(mismatch_prefix) + "-reference.png")
        after.save(str(mismatch_prefix) + "-candidate.png")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pair", nargs=3, action="append", required=True, metavar=("LABEL", "REFERENCE", "CANDIDATE"))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dpi", type=int, default=96)
    parser.add_argument("--save-mismatches", action="store_true")
    args = parser.parse_args()
    if not 36 <= args.dpi <= 300:
        parser.error("dpi must be between 36 and 300")
    if len({pair[0] for pair in args.pair}) != len(args.pair):
        parser.error("pair labels must be unique")
    if any(Path(label).name != label or label in (".", "..") for label, _, _ in args.pair):
        parser.error("pair labels must be simple directory names")
    args.output.mkdir(parents=True, exist_ok=True)
    report = {
        "renderer": "PyMuPDF",
        "pymupdfVersion": pymupdf.version[0],
        "mupdfVersion": pymupdf.version[1],
        "pythonVersion": platform.python_version(),
        "dpi": args.dpi,
        "rendering": "RGB, opaque white background, annotations enabled, exact pixel equality",
        "sampling": "First, middle and last page of each PDF; duplicate page indices removed",
        "limitations": [
            "Only sampled pages and this renderer/resolution are checked, not every page or viewer.",
            "Checks structural rewriting of the same JPEG candidate, not lossy JPEG quality against the original.",
            "Pixel equality does not establish semantic preservation, signature validity or PDF/A compliance.",
        ],
        "pairs": [],
    }
    any_failure = False
    for label, reference_folder, candidate_folder in args.pair:
        reference_folder, candidate_folder = Path(reference_folder).resolve(), Path(candidate_folder).resolve()
        pair = {"label": label, "reference": str(reference_folder), "candidate": str(candidate_folder), "files": []}
        report["pairs"].append(pair)
        names = sorted(path.name for path in reference_folder.glob("*.pdf"))
        if not names:
            pair["error"] = "No reference PDFs found"
            any_failure = True
        for index, name in enumerate(names, 1):
            row = {"name": name, "sampledPages": []}
            pair["files"].append(row)
            try:
                with pymupdf.open(reference_folder / name) as reference, pymupdf.open(candidate_folder / name) as candidate:
                    row["referencePageCount"], row["candidatePageCount"] = len(reference), len(candidate)
                    if len(reference) != len(candidate) or not len(reference):
                        raise ValueError("Page counts differ or document has no pages")
                    pages = sorted({0, (len(reference) - 1) // 2, len(reference) - 1})
                    for page_number in pages:
                        prefix = args.output / label / name.removesuffix(".pdf") / f"page-{page_number + 1}" if args.save_mismatches else None
                        row["sampledPages"].append(compare_page(reference, candidate, page_number, args.dpi, prefix))
                    row["matches"] = all(page["identical"] for page in row["sampledPages"])
            except Exception as error:
                row.update({"matches": False, "error": str(error)})
            any_failure |= not row["matches"]
            print(f"{label}: PDF {index:02d}: {'IDENTICAL' if row['matches'] else 'DIFFERENT/ERROR'}", flush=True)
            (args.output / "render-results.json").write_text(json.dumps(report, indent=2))
        pair["allMatch"] = bool(names) and all(row["matches"] for row in pair["files"])
        pair["sampledPageCount"] = sum(len(row["sampledPages"]) for row in pair["files"])
    report["allMatch"] = not any_failure
    (args.output / "render-results.json").write_text(json.dumps(report, indent=2))
    raise SystemExit(1 if any_failure else 0)


if __name__ == "__main__":
    main()
