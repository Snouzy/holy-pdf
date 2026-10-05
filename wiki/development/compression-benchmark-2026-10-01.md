# Compress: benchmark and engine choice

_Study of 1 October 2026. Measurement prototypes only: no new dependency in the product._

## Question and criteria

Choose how to make PDFs lighter while keeping their structure, with processing done only in the browser. The corrected engine keeps the document, but its save can unpack the objects. Report 02 grows ×2.65 before any change to the images.

The criteria, in this order: preservation of the checked content and features; real gain of the delivered file; local execution in a Worker; time and memory; weight loaded on demand; license and maintenance. The historical threshold stays a median of 30% on the first five PDFs of the batch, not on a selection made after the measurement.

A lossless structural optimization changes the binary representation, not the content of the document. It stays compatible with the promise "only the photos change", in the visual and functional sense. This does not mean that a digital signature stays valid after a rewrite.

## Protocol

- Eleven private PDFs, named here only by their number. No transmission to a processing service.
- Comparison of the originals, of the PDFium save without transformation, and of the Recommended candidates before any fallback to the original.
- Photo settings kept: 150 ppi, JPEG quality 0.6. The old candidates use `jpeg-js` and nearest-neighbor resizing. A separate campaign uses the real `OffscreenCanvas` of the product.
- Three runs per variant, median time. CPU campaigns run one after the other. Native measurements are not presented as browser measurements.
- Delivered gain: zero when the candidate does not make the file at least 1% smaller. The structure check covers the candidates, even when they would not be delivered.
- Independent pdf.js reader: destinations resolved to page numbers, bookmarks, links, geometry, text, accessibility trees, fields, metadata, XMP and attachment hashes. Tolerance of 0.001 point on geometric numbers for the float32 conversion of PDFium. PDF version and linearization are excluded from the equality.
- These checks do not validate signatures, PDF/A conformance, execution of Acrobat JavaScript, dynamic XFA forms or the visual quality of the photos. The memory peak of the full Worker is still to be measured before integration.

## Survey: what the sources establish

| Solution | Relevance for Holy PDF | Deciding limit |
|---|---|---|
| PDFium alone | Already integrated to read and process images | No public option to rewrite Object Streams |
| PDFium + qpdf | Images with PDFium, structural optimization with a specialized tool | A second WASM module and its adapter to maintain |
| PDFium + `@cantoo/pdf-lib` | JavaScript control, active MIT fork, writes Object Streams | Check preservation, parsing time and memory |
| MuPDF | Official JS/WASM engine, compacted save | AGPL or commercial license; a broader replacement to evaluate |
| Ghostscript `pdfwrite` | Effective for some conversions and reductions | Rebuilds the PDF and does not keep all the information |
| Apryse Web Optimizer | Browser optimizer with downsampling | Commercial option under an additional license, not measured here |
| lopdf | MIT Rust library with Object Streams | New Rust/WASM chain and extra integration, not measured here |

### PDFium: do not wait for a hypothetical fix

The [Chromium ticket 480028277](https://issues.chromium.org/issues/480028277), opened on 30 January 2026, asks to bring back the writing of Object Streams/XRef Streams. It is still open, with no verified fix attached. It is a user report, not a promise from the maintainer. The [official save header](https://pdfium.googlesource.com/pdfium/+/main/public/fpdf_save.h) does not offer this option. These facts agree with our observation. They are not enough to attribute all the growth of a file to the objects alone.

### qpdf: a complement for the structure

The [documented goal of qpdf](https://qpdf.readthedocs.io/en/stable/overview.html) is the structural transformation of PDFs. The [optimization documentation](https://qpdf.readthedocs.io/en/stable/cli.html#optimizing-file-size) separates Object Streams, Flate recompression and lossy JPEG. In [discussion #1402](https://github.com/qpdf/qpdf/issues/1402#issuecomment-2744693122), the maintainer confirms that qpdf does not downsample images: it complements our photo processing.

The [release 12.4.2](https://github.com/qpdf/qpdf/releases/tag/v12.4.2) and the [Apache-2.0 license](https://github.com/qpdf/qpdf/blob/main/LICENSE.txt) are the references consulted. The browser port tested is `@wasm-zoo/qpdf@0.1.1`, a third-party distribution of qpdf 12.4.2. It is not an official qpdf Web SDK.

Two conversations change the precautions for the choice:

- [#1785](https://github.com/qpdf/qpdf/issues/1785) reports a growth of 31% on another file with `/Filter [/FlateDecode]` and a predictor. The suggested workaround is `--stream-data=preserve`. The ticket is open and not reproduced on this corpus: compare the settings, do not generalize the report.
- [#702](https://github.com/qpdf/qpdf/issues/702) reports the loss of a behavior of a signed LiveCycle form while the JavaScript stays present. It was closed for inactivity, not as a confirmed fix. Counting the fields does not prove that all interactive forms work.

The [discussion #394](https://github.com/qpdf/qpdf/issues/394) also shows that qpdf is not designed as a set of small functions that compile separately. A WASM port is possible, but a tiny official subset is not established.

### pdf-lib: tell the historical repository apart from the active fork

The last release of the historical repository is [1.17.1, November 2021](https://github.com/Hopding/pdf-lib/releases/tag/v1.17.1). The [Cantoo](https://github.com/cantoo-scribe/pdf-lib) fork, npm version 2.11.1 at the time of the study, is active and under MIT. So it deserves a control, against the shortcut "pdf-lib is abandoned".

The benchmark loads the existing document with `updateMetadata:false` and `preserveXFA:true`, then saves with `useObjectStreams:true`, `updateFieldAppearances:false` and `addDefaultPage:false`. It does not copy the pages. The [reference code](https://github.com/cantoo-scribe/pdf-lib/blob/eafae49f9704b037b9474bd51309c3e9dca0e44b/src/api/PDFDocument.ts) still calls a sync of the PDF/A metadata: the XMP equality must be measured, not assumed.

### Other options

[Official MuPDF.js](https://github.com/ArtifexSoftware/mupdf.js) exposes the [compacted save options](https://mupdf.readthedocs.io/en/1.28.1/reference/common/pdf-write-options.html). The publisher distributes it under AGPL and offers a commercial license. The AGPL is compatible with the project's license (AGPL-3.0), but adopting it would be a broader engine replacement, to evaluate on its own. The native PyMuPDF benchmark is a control of the engine, not a validation of the browser SDK nor a license decision.

The [Ghostscript documentation](https://ghostscript.readthedocs.io/en/latest/VectorDevices.html) explains that `pdfwrite` rebuilds a new document and does not keep all the information, notably some non-visual elements. This path does not meet our preservation requirement. A WASM wrapper does not change this behavior.

The [official Apryse example](https://docs.apryse.com/web/get-started/samples/optimizertest) states that the optimizer requires an additional license. [lopdf 0.45.0](https://github.com/J-F-Liu/lopdf/releases/tag/v0.45.0) is an MIT alternative to watch, but adding Rust/WASM is not justified without a measured advantage over the candidates already available.

## Results

### Real compression in Chromium

Apple M1 Pro, macOS 26.4.1, Chromium 153, PDFium `@embedpdf/pdfium@2.15.1`, three repetitions. The real Worker of the product encodes the photos, then each candidate goes through the different compactors. The percentages are always relative to the original file and include the fallback to the original below a 1% gain.

| PDF | PDFium alone | + qpdf standard | + qpdf Flate 9 | + Cantoo | PDFium compression time | qpdf standard step |
|---|---:|---:|---:|---:|---:|---:|
| 01 | 78.41% | 82.79% | 82.88% | 81.13% | 3.24 s | 0.15 s |
| 02 | 0.00% | 40.23% | 42.11% | 30.80% | 1.38 s | 0.67 s |
| 03 | 0.00% | 22.72% | 23.48% | 4.12% | 0.73 s | 0.12 s |
| 04 | 2.92% | 13.49% | 30.09% | 5.44% | 1.27 s | 0.10 s |
| 05 | 66.99% | 67.87% | 67.88% | 67.81% | 6.00 s | 0.07 s |
| 06 | 0.00% | 0.00% | 0.00% | 0.00% | 0.05 s | 0.04 s |
| 07 | 34.94% | 37.53% | 42.50% | 37.20% | 0.35 s | 0.08 s |
| 08 | 75.96% | 76.84% | 78.51% | 76.70% | 0.36 s | 0.06 s |
| 09 | 0.00% | 35.27% | 38.12% | 30.77% | 0.17 s | 0.13 s |
| 10 | 69.58% | 77.99% | 78.52% | 75.74% | 2.54 s | 0.08 s |
| 11 | 16.10% | 30.89% | 31.64% | 29.31% | 0.21 s | 0.06 s |

| Method after the browser JPEG | Median of PDFs 01–05 | Median of the 11 | Median of the added step | Maximum of the added step |
|---|---:|---:|---:|---:|
| None | 2.92% | 16.10% | — | — |
| qpdf standard | **40.23%** | 37.53% | **0.083 s** | 0.669 s |
| qpdf with Flate recompression at level 9 | 42.11% | 42.11% | 0.338 s | 1.695 s |
| qpdf `--stream-data=preserve` | 3.47% | 17.94% | 0.083 s | 0.590 s |
| Cantoo pdf-lib 2.11.1 | 30.80% | 30.80% | 0.307 s | 1.703 s |

The PDFium times exclude the opening and the initialization of the Worker. The compactor times include the creation of the Worker, the initialization of the module and the input/output copies. None of them includes a real network download of the dependencies. These are steps measured separately, not a full timing of the integrated interface.

**Measured standard setting:** `--object-streams=generate --compress-streams=y`, without `--recompress-flate`, without extra JPEG optimization. The Flate 9 variant adds `--recompress-flate --compression-level=9 --decode-level=generalized`. The benchmark also uses `--warning-exit-0` to collect the PDFs produced with warnings. The messages are kept in the reports, not ignored in the analysis. Originals 07 and 08 triggered warnings about repaired cross-references in the exploratory campaign. The standard PDFium candidates did not trigger any.

The `--stream-data=preserve` workaround is **not** a good global setting for our pipeline: it also keeps the uncompressed streams as they are, which blocks a large part of the expected benefit. Do not confuse it with the native profile that compresses the raw streams and keeps the existing Flate streams.

Flate 9 helps PDF 04 in particular (13.49 → 30.09%) but costs 1.70 s on this file, against 0.10 s for standard. Standard is the best starting point for responsiveness and for phones. The measurements do not justify a maximum recompression every time.

### Native breakdown and controls

132 variants, three repetitions each: 11 documents × three inputs (original, PDFium save, Node JPEG) × four methods. Python 3.13.3, pikepdf 10.16.0/libqpdf 12.4.2 and PyMuPDF 1.28.2, in a temporary environment outside the dependencies of the product.

| Native method | Median of PDFs 01–05 | Median of the 11 |
|---|---:|---:|
| qpdf on the originals, Object Streams + Flate 9 | 23.41% | 8.79% |
| Node JPEG + qpdf Flate 9, without Object Streams | 24.96% | 24.96% |
| Node JPEG + qpdf Object Streams + Flate 9 | 36.78% | 37.99% |
| Node JPEG + qpdf Object Streams, existing Flate kept | 35.00% | 35.00% |
| Node JPEG + MuPDF compaction/deduplication | 6.47% | 21.49% |

These figures use the old Node JPEGs and do not compare directly with the percentages of the Chromium table. MuPDF does better on some presentations (56.66% and 79.49% on 07/08), but the setting tested does not solve report 02. This does not set a limit for all the possible options of MuPDF.

Report 02 explains the blockage: original 5.54 MB; PDFium save 14.69 MB; save followed by qpdf Object Streams/Flate 9 about 4.05 MB, a 26.96% reduction **without changing the photos**. Adding the Node JPEGs brings this result to 36.78%. With the Chromium JPEGs and standard qpdf, the final result reaches 40.23%. The structural gain is now identified separately, without removing features to get it.

### Browser cost and compatibility

| Measured distribution | Raw required files | Local Brotli sum | Execution |
|---|---:|---:|---|
| qpdf WASM Zoo 0.1.1 / engine 12.4.2 | 2.27 MB, of which WASM 2.20 MB | 0.525 MB | Worker, without `SharedArrayBuffer` or COOP/COEP isolation |
| Cantoo pdf-lib 2.11.1, minified UMD bundle | 0.617 MB | 0.222 MB | JavaScript Worker |

The Brotli sizes are local estimates with the default compression of Node, not measurements of the Cloudflare transfer. The module must load when Compress starts, to keep the initial budget of 50 KB. At the time of this comparison, this loading was not integrated. The validation of the integrated product is in [Web version](web-version.md#qpdf-integration-1-october-2026).

Standard qpdf also passes the 02/05 trials in Firefox 155 and WebKit 26.6. Firefox uses its own JPEGs. The first WebKit qpdf trial uses the Chromium candidates. So this comparison does not yet measure the full WebKit flow.

**Correction of the WebKit diagnosis during integration:** the bench refused all URLs outside its HTTP origin, including the local `blob:` URLs that WebKit uses to read `blob.arrayBuffer()`. The `NotReadableError` error came from this network interception, not from the encoder. The bench now allows only the HTTP and Blob URLs of its own origin, and first checks a 55 KB Blob in the Worker.

Without a change to `jpeg.ts`, the **11 PDFs pass three times in WebKit 26.6**, with identical outputs between passes. Median of PDFs 01–05 for PDFium alone: **2.19%**. PDF 01: 68.53%, PDF 05: 37.50%. The old logs are kept, and the corrected results are in `runs/browser-baseline-webkit-corrected/`. A test of the production Worker also checks a JPEG larger than 55 KB, its dimensions and its colors in the three browsers. Safari on a real device was not tested.

Do not import the WASM Zoo port used for the measurements blindly: its facade depends on `window`/`document`, creates one Worker per call and treats qpdf warnings as errors by default. The integrated adapter controls the Worker lifecycle, the outputs with warnings and the exact engine version. It imports the qpdf core after an ESM packaging adaptation, without this facade. No full memory peak is claimed here.

### Preservation

The render comparisons of the structural step pass: **33/33 pages for standard qpdf, 33/33 for qpdf Flate 9, 33/33 for Cantoo**, with no pixel different from the same Chromium JPEG candidates before recompaction. PyMuPDF 1.28.2 renders the first page, the middle page and the last page of the 11 documents, opaque RGB, 96 dpi, annotations on.

132 additional comparisons also pass: originals and Node JPEGs after qpdf or MuPDF. This is a sample of the pages and a validation of the recompaction. No SSIM score of the JPEGs against the originals is inferred from these equalities.

**226/226 examined outputs pass the independent semantic comparison**: 132 native variants and 11 saves alone; 22 exploratory qpdf outputs in Chromium; 61 final outputs (13 browser baselines, 15 standard qpdf in the three engines, 11 qpdf Flate 9, 11 qpdf with stream preservation, 11 Cantoo). The checks also include the resolved named destinations.

This result means that the checked invariants are preserved on the corpus. Other annotations, JavaScript actions, the behavior of dynamic forms, OCG layers and signatures are not validated by this comparison. The verification scripts fail on a difference, on an error, or when the PDF count differs from the expected one.

## Proposed decision

**Keep PDFium for the images and add qpdf for the structure, with the standard setting.** It is the best measured compromise: the 30% threshold is passed with margin, the gain is better than Cantoo, the added time is low, and the engine is dedicated to structural transformations. The extra download is about 0.3 MB Brotli compared with the Cantoo control, and it must stay deferred.

Do not write our own object compactor at this stage. Do not replace the whole engine with MuPDF without a demonstrated benefit and a commercial license decision. Keep the fallback to the original if the output does not gain 1%, and tell apart the files compatible with Object Streams from profiles such as PDF/A-1.

This study chooses an architecture. It does not validate a merge by itself. The integration authorized afterwards is tracked in [Web version](web-version.md). The apparent WebKit failure was fixed in the bench, without a change to the encoder. The integrated validation also covers memory and the visual quality of the JPEGs. The results of recompaction alone stay separate.

## Reproduction and files

- `apps/web/scripts/benchmark-compression-options.mjs`: reference PDFium save and independent semantic verification.
- `apps/web/scripts/benchmark-compression-options.py`: native engines isolated in a temporary environment.
- `apps/web/scripts/benchmark-browser-baseline.mjs`: real compression of the product in a browser Worker.
- `apps/web/scripts/benchmark-qpdf-browser.mjs`: qpdf WASM recompaction and Cantoo control in Workers, server bound to `127.0.0.1` only.
- Corpus, outputs and detailed reports under `fixtures-private/compress/runs/`, ignored by git.

Prepare the benchmark runtimes outside the product, from the root of the repository:

```sh
mkdir -p /tmp/holy-pdf-compression-research/zoo /tmp/holy-pdf-compression-research/cantoo
npm pack @wasm-zoo/qpdf@0.1.1 --pack-destination /tmp/holy-pdf-compression-research --silent
npm pack @cantoo/pdf-lib@2.11.1 --pack-destination /tmp/holy-pdf-compression-research --silent
tar -xzf /tmp/holy-pdf-compression-research/wasm-zoo-qpdf-0.1.1.tgz -C /tmp/holy-pdf-compression-research/zoo
tar -xzf /tmp/holy-pdf-compression-research/cantoo-pdf-lib-2.11.1.tgz -C /tmp/holy-pdf-compression-research/cantoo

python3 -m venv /tmp/holy-pdf-compression-benchmark-venv
/tmp/holy-pdf-compression-benchmark-venv/bin/pip install pikepdf==10.16.0 PyMuPDF==1.28.2
node apps/web/scripts/benchmark-compression-options.mjs prepare
/tmp/holy-pdf-compression-benchmark-venv/bin/python apps/web/scripts/benchmark-compression-options.py
```

The native control assumes that the old Node candidates already exist in `runs/preserve-structure/`. Their generation command is in [Web version](web-version.md#compression-measurements). The embedded libqpdf versions are logged at launch: pinning pikepdf does not remove the need to check the engine it actually uses.

Browser campaigns from `apps/web/`:

```sh
node scripts/benchmark-browser-baseline.mjs

CANDIDATE_DIR=../../fixtures-private/compress/runs/browser-baseline/chromium \
BENCH_OUTPUT=../../fixtures-private/compress/runs/browser-qpdf-default \
VARIANTS=candidate QPDF_PROFILE=default \
node scripts/benchmark-qpdf-browser.mjs

CANDIDATE_DIR=../../fixtures-private/compress/runs/browser-baseline/chromium \
BENCH_OUTPUT=../../fixtures-private/compress/runs/browser-cantoo \
VARIANTS=candidate ENGINE=cantoo \
node scripts/benchmark-qpdf-browser.mjs
```

The default temporary paths are in the script. `QPDF_RUNTIME` lets you give the folder of the qpdf runtime or the `dist` folder of Cantoo. The final reports record the provenance and the SHA-256 of each input. The exploratory campaign `benchmark-browser/` used the Node JPEGs. Only `browser-qpdf-*` and `browser-cantoo/` use the new Chromium baseline for the recommendation.

Check a full output from the root:

```sh
BENCH_EXPECT_PDFS=11 BENCH_VERIFY_REPORT=qpdf-standard-structure.json \
node apps/web/scripts/benchmark-compression-options.mjs verify \
fixtures-private/compress/runs/browser-qpdf-default/chromium-candidate

/tmp/holy-pdf-compression-benchmark-venv/bin/python apps/web/scripts/verify-compression-render.py \
--pair qpdf-standard fixtures-private/compress/runs/browser-baseline/chromium \
fixtures-private/compress/runs/browser-qpdf-default/chromium-candidate
```
