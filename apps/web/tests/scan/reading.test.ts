import { existsSync, readFileSync } from "node:fs";
import { encode } from "jpeg-js";
import { createWorker, OEM } from "tesseract.js";
import { beforeAll, expect, it } from "vitest";
import { heicCaptureDay } from "../../src/engine/exif";
import { type CV, type Mat, matOf } from "../../src/scan/cv";
import type { RenderMode } from "../../src/scan/enhance";
import type { Quad } from "../../src/scan/geometry";
import { fitted, scanPage } from "../../src/scan/pipeline";
import { turnedClockwise } from "../../src/scan/rectify";
import { suggest } from "../../src/scan/suggest";
import { readingScore, readLines } from "../../src/scanner/reading";
import { heicPhoto, loadCv, privatePhotos } from "./support";

const edits = new URL("../../../../fixtures-private/edits.json", import.meta.url).pathname;
const expected = new URL("../../../../fixtures-private/expected.json", import.meta.url).pathname;
const languages = new URL("../../public/ocr/lang", import.meta.url).pathname;
let cv: CV;
beforeAll(async () => {
  cv = await loadCv();
});

const jpeg = (image: Mat) => new Uint8Array(encode({ data: image.data, width: image.cols, height: image.rows }, 90).data);

function small(image: Mat): Mat {
  const factor = Math.min(1, 1200 / Math.max(image.cols, image.rows));
  const out = new cv.Mat();
  cv.resize(image, out, new cv.Size(Math.round(image.cols * factor), Math.round(image.rows * factor)), 0, 0, cv.INTER_AREA);
  return out;
}

/** The criteria of the Mac scanner's spec, with the corners, modes and erasing set by hand and the turns left to the reading. */
/** About seven minutes with the private photos: run with `SCAN_BENCH=1 pnpm test`, not on every run. */
it.skipIf(!process.env.SCAN_BENCH || !existsSync(edits) || !existsSync(languages))("turns every page upright, and groups and dates the documents like the Mac", { timeout: 1_800_000 }, async () => {
  const corrected = JSON.parse(readFileSync(edits, "utf8")) as Record<string, { quad: Quad; mode: RenderMode }>;
  const truth = JSON.parse(readFileSync(expected, "utf8")) as { pages: { file: string; quarterTurns: number }[]; documents: { files: string[]; date: string }[] };
  const worker = await createWorker(["ron", "fra", "eng"], OEM.LSTM_ONLY, { langPath: languages, cacheMethod: "none", gzip: true });
  const pages = [];
  const rows: string[] = [];
  for (const { file, quarterTurns } of truth.pages) {
    const bytes = readFileSync(`${privatePhotos}${file}`);
    const photo = matOf(cv, await heicPhoto(`${privatePhotos}${file}`));
    const image = fitted(cv, photo);
    photo.delete();
    const flat = scanPage(cv, image, { quad: corrected[file]!.quad, mode: corrected[file]!.mode, quarterTurns: 0, erase: [] })!;
    image.delete();
    let best = { turns: 0, score: 0 };
    const sample = small(flat.image);
    for (let turns = 0; turns < 4; turns++) {
      const turned = turnedClockwise(cv, sample, turns);
      const score = await readingScore(worker, jpeg(turned));
      turned.delete();
      if (score > best.score) best = { turns, score };
    }
    sample.delete();
    const upright = turnedClockwise(cv, flat.image, best.turns);
    flat.image.delete();
    const lines = await readLines(worker, jpeg(upright), upright.cols, upright.rows);
    upright.delete();
    pages.push({ id: file, lines, captureDay: heicCaptureDay(bytes) ?? undefined });
    rows.push(`${file} turns=${best.turns}${best.turns === quarterTurns ? "" : ` WRONG (${quarterTurns})`} lines=${lines.length} day=${pages.at(-1)!.captureDay}`);
  }
  await worker.terminate();
  const suggestions = suggest(pages, "2026-10-03");
  rows.push(...suggestions.map((suggestion) => `${suggestion.name} ← ${suggestion.pageIds.join(" ")} [${suggestion.evidence.map((each) => each.text).join(" · ")}]`));
  console.log(rows.join("\n"));
  const upright = truth.pages.filter((page, index) => rows[index]!.includes(`turns=${page.quarterTurns}`) && !rows[index]!.includes("WRONG")).length;
  const grouped = truth.documents.filter((doc) => suggestions.some((suggestion) => suggestion.pageIds.join() === doc.files.join())).length;
  const dated = truth.documents.filter((doc) => suggestions.some((suggestion) => suggestion.pageIds.includes(doc.files[0]!) && suggestion.name.startsWith(doc.date))).length;
  expect({ upright, groupedAtLeastTen: grouped >= 10, datedAtLeastNine: dated >= 9, grouped, dated }).toMatchObject({ upright: truth.pages.length, groupedAtLeastTen: true, datedAtLeastNine: true });
});
