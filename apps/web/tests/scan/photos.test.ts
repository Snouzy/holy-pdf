import { existsSync, readFileSync } from "node:fs";
import { decode, encode } from "jpeg-js";
import { beforeAll, expect, it } from "vitest";
import { type CV, matOf } from "../../src/scan/cv";
import { detect } from "../../src/scan/detect";
import type { RenderMode } from "../../src/scan/enhance";
import type { EraseMark } from "../../src/scan/erase";
import { maxCornerShift, type Point, type Quad } from "../../src/scan/geometry";
import { fitted, scanPage } from "../../src/scan/pipeline";
import { heicPhoto, loadCv, privatePhotos } from "./support";

const edits = new URL("../../../../fixtures-private/edits.json", import.meta.url).pathname;
/** A few minutes with the private photos: run with `SCAN_BENCH=1 pnpm test`, not on every run. */
const bench = Boolean(process.env.SCAN_BENCH) && existsSync(edits);
const expected = new URL("../../../../fixtures-private/expected.json", import.meta.url).pathname;
const reference = new URL("../../../../fixtures-private/reference/", import.meta.url).pathname;
type SwiftMark = { polygon?: { points: Point[] }; stroke?: { points: Point[]; radius: number } };
type Edit = { quad: Quad; quarterTurns: number; mode: RenderMode; erase?: SwiftMark[] };
let cv: CV;
beforeAll(async () => {
  cv = await loadCv();
});

/** The 17 photos of the reference batch, against the corners corrected by hand (spec of the Mac scanner). */
it.skipIf(!bench)("flags every page whose automatic corners are wrong, and at most two good ones", { timeout: 600_000 }, async () => {
  const corrected = JSON.parse(readFileSync(edits, "utf8")) as Record<string, { quad: Quad }>;
  const rows: string[] = [];
  let [wrongMissed, goodFlagged] = [0, 0];
  for (const [file, { quad }] of Object.entries(corrected)) {
    const photo = await heicPhoto(`${privatePhotos}${file}`);
    const image = matOf(cv, photo);
    const scale = Math.min(1, 4096 / Math.max(image.cols, image.rows));
    cv.resize(image, image, new cv.Size(Math.round(image.cols * scale), Math.round(image.rows * scale)), 0, 0, cv.INTER_AREA);
    const start = performance.now();
    const found = detect(cv, image);
    const time = performance.now() - start;
    const shift = maxCornerShift(found.quad, quad, { width: image.cols, height: image.rows });
    image.delete();
    const wrong = shift > 0.015;
    if (wrong && found.reasons.length === 0) wrongMissed++;
    if (!wrong && found.reasons.length > 0) goodFlagged++;
    rows.push(`${file} shift=${(shift * 100).toFixed(1)}% ${wrong ? "WRONG" : "ok"} reasons=${found.reasons.join(",") || "-"} ${Math.round(time)} ms`);
  }
  console.log(rows.join("\n"));
  expect({ wrongMissed, goodFlaggedAtMostTwo: goodFlagged <= 2 }).toEqual({ wrongMissed: 0, goodFlaggedAtMostTwo: true });
});

/** The pages with the corners, turns, modes and erasing set by hand, and the watermark left to the detector. */
it.skipIf(!bench)("matches the prototype's pages, finds the watermarks, and keeps a page under 500 KB", { timeout: 900_000 }, async () => {
  const corrected = JSON.parse(readFileSync(edits, "utf8")) as Record<string, Edit>;
  const watermarks = new Map((JSON.parse(readFileSync(expected, "utf8")) as { pages: { file: string; watermark: boolean }[] }).pages.map((page) => [page.file, page.watermark]));
  const rows: string[] = [];
  const results: { gap: number; watermarkRight: boolean; bytes: number; mode: RenderMode }[] = [];
  for (const [file, edit] of Object.entries(corrected)) {
    const photo = matOf(cv, await heicPhoto(`${privatePhotos}${file}`));
    const image = fitted(cv, photo);
    photo.delete();
    const marks: EraseMark[] = (edit.erase ?? []).map((mark) => (mark.polygon ? { kind: "polygon", points: mark.polygon.points } : { kind: "stroke", points: mark.stroke!.points, radius: mark.stroke!.radius }));
    const start = performance.now();
    const page = scanPage(cv, image, { quad: edit.quad, quarterTurns: edit.quarterTurns, mode: edit.mode, erase: marks })!;
    const time = performance.now() - start;
    image.delete();
    const jpeg = encode({ data: page.image.data, width: page.image.cols, height: page.image.rows }, 80).data;
    const prototype = decode(readFileSync(`${reference}${file.replace(".HEIC", ".jpg")}`));
    const resized = new cv.Mat();
    cv.resize(page.image, resized, new cv.Size(prototype.width, prototype.height), 0, 0, cv.INTER_AREA);
    let gap = 0;
    for (let index = 0; index < prototype.width * prototype.height; index++) {
      const ours = (resized.data[index * 4]! + resized.data[index * 4 + 1]! + resized.data[index * 4 + 2]!) / 3;
      const theirs = (prototype.data[index * 4]! + prototype.data[index * 4 + 1]! + prototype.data[index * 4 + 2]!) / 3;
      gap += Math.abs(ours - theirs);
    }
    gap /= prototype.width * prototype.height;
    resized.delete();
    const watermarkRight = edit.mode === "color" || page.keepWatermark === watermarks.get(file);
    results.push({ gap, watermarkRight, bytes: jpeg.length, mode: edit.mode });
    rows.push(`${file} ${page.image.cols}x${page.image.rows} gap=${gap.toFixed(1)} watermark=${page.keepWatermark}${watermarkRight ? "" : " WRONG"} ${Math.round(jpeg.length / 1024)} KB ${Math.round(time)} ms`);
    page.image.delete();
  }
  console.log(rows.join("\n"));
  const documents = results.filter((result) => result.mode === "document");
  expect({
    watermarksRight: documents.filter((result) => result.watermarkRight).length,
    gapUnderTen: results.every((result) => result.gap < 10),
    meanBytesUnder500KB: results.reduce((sum, result) => sum + result.bytes, 0) / results.length < 500 * 1024,
  }).toEqual({ watermarksRight: documents.length, gapUnderTen: true, meanBytesUnder500KB: true });
});
