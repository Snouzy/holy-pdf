"""Native structural compression benchmark; never uploads files or changes product code.

Run with an isolated Python environment containing pikepdf and pymupdf:
  python apps/web/scripts/benchmark-compression-options.py
Prepare PDFium save-only inputs and verify with the accompanying .mjs script.
"""

import argparse
import hashlib
import json
import platform
import statistics
import time
from pathlib import Path

import pikepdf
import pymupdf


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "fixtures-private/compress"
OUTPUT = SOURCE / "runs/benchmark-options"
METHODS = ("qpdf-flate", "qpdf-object-streams", "qpdf-object-streams-preserve-flate", "mupdf-lossless")


def optimize(source, target, method):
    if method.startswith("qpdf"):
        with pikepdf.open(source) as pdf:
            pdf.save(
                target,
                compress_streams=True,
                recompress_flate=method != "qpdf-object-streams-preserve-flate",
                stream_decode_level=(
                    pikepdf.StreamDecodeLevel.none
                    if method == "qpdf-object-streams-preserve-flate"
                    else pikepdf.StreamDecodeLevel.generalized
                ),
                object_stream_mode=(
                    pikepdf.ObjectStreamMode.generate
                    if method.startswith("qpdf-object-streams")
                    else pikepdf.ObjectStreamMode.disable
                ),
                normalize_content=False,
                fix_metadata_version=False,
                deterministic_id=True,
            )
    else:
        with pymupdf.open(source) as pdf:
            pdf.save(
                target,
                garbage=4,
                deflate=True,
                deflate_images=True,
                deflate_fonts=True,
                use_objstms=1,
                compression_effort=9,
                preserve_metadata=True,
                no_new_id=True,
            )


def gain(original, candidate):
    return (1 - candidate / original) * 100 if candidate <= original * 0.99 else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repetitions", type=int, default=3)
    args = parser.parse_args()
    pikepdf._core.set_flate_compression_level(9)
    historical = {row["name"]: row for row in json.loads((SOURCE / "runs/preserve-structure/measurements.json").read_text())}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {
        "protocol": {
            "date": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "platform": platform.platform(),
            "python": platform.python_version(),
            "pikepdf": pikepdf.__version__,
            "libqpdf": pikepdf.__libqpdf_version__,
            "pymupdf": pymupdf.version[0],
            "repetitions": args.repetitions,
            "flateCompressionLevel": 9,
            "timing": "Sequential native open+rewrite+close, median wall time, warm OS cache after first repetition; no JPEG encoding in timing.",
            "candidate": "Existing Recommended PDFium/jpeg-js 150 ppi quality 0.6; nearest-neighbour resize; not browser JPEG or visual-quality evidence.",
            "lossless": "No photo downsampling or lossy image reencoding in any optimizer; MuPDF additionally deduplicates objects/streams.",
            "preserveFlateProfile": "compress_streams=True, recompress_flate=False, stream_decode_level=none, object_stream_mode=generate: compressed streams remain encoded, uncompressed streams can be compressed. This is not CLI --stream-data=preserve.",
            "delivery": "Original is delivered when candidate saves less than 1 percent.",
            "metadata": "qpdf fix_metadata_version=False; MuPDF preserve_metadata=True, no_new_id=True. PDF IDs may still change under qpdf.",
        },
        "rows": [],
    }
    for name, previous in sorted(historical.items()):
        original_size = (SOURCE / name).stat().st_size
        if original_size != previous["originalBytes"]:
            raise ValueError(f"Historical original size changed: {name}")
        row = {
            "name": name,
            "originalBytes": original_size,
            "originalSha256": hashlib.sha256((SOURCE / name).read_bytes()).hexdigest(),
            "historical": previous,
            "variants": [],
        }
        inputs = {
            "original": SOURCE / name,
            "recommended": SOURCE / "runs/preserve-structure" / name,
            "save-only": OUTPUT / "save-only" / name,
        }
        for input_name, source in inputs.items():
            if not source.exists():
                continue
            if input_name == "recommended":
                expected = next(level["bytes"] for level in previous["levels"] if level["level"] == "recommended")
                if source.stat().st_size != expected:
                    raise ValueError(f"Historical candidate size changed: {name}")
            source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
            for method in METHODS:
                destination = OUTPUT / f"{input_name}-{method}" / name
                destination.parent.mkdir(exist_ok=True)
                times = []
                for _ in range(args.repetitions):
                    start = time.perf_counter()
                    optimize(source, destination, method)
                    times.append(time.perf_counter() - start)
                size = destination.stat().st_size
                variant = {
                    "input": input_name,
                    "method": method,
                    "path": str(destination.relative_to(ROOT)),
                    "inputBytes": source.stat().st_size,
                    "inputSha256": source_hash,
                    "bytes": size,
                    "rawGainPercent": (1 - size / original_size) * 100,
                    "deliveredGainPercent": gain(original_size, size),
                    "medianSeconds": statistics.median(times),
                    "seconds": times,
                }
                row["variants"].append(variant)
                print(f"{name} {input_name} {method}: {size} bytes, gain {variant['deliveredGainPercent']:.2f}%, {variant['medianSeconds']:.3f}s", flush=True)
        report["rows"].append(row)
        (OUTPUT / "native-results.json").write_text(json.dumps(report, indent=2))
    summary = []
    for input_name in ("original", "recommended", "save-only"):
        for method in METHODS:
            variants = [next((v for v in r["variants"] if v["input"] == input_name and v["method"] == method), None) for r in report["rows"]]
            if not all(variants):
                continue
            summary.append({
                "input": input_name,
                "method": method,
                "medianFirstFivePercent": statistics.median(v["deliveredGainPercent"] for v in variants[:5]),
                "medianAllElevenPercent": statistics.median(v["deliveredGainPercent"] for v in variants),
                "medianSeconds": statistics.median(v["medianSeconds"] for v in variants),
                "totalBytes": sum(v["bytes"] if v["bytes"] <= r["originalBytes"] * 0.99 else r["originalBytes"] for r, v in zip(report["rows"], variants)),
            })
    report["summary"] = summary
    (OUTPUT / "native-results.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
