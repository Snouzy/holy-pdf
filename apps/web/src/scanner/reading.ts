import type { Worker } from "tesseract.js";
import type { TextLine } from "../scan/suggest";

const sampleLongSide = 1200;

/** Clockwise quarter turns that make the text upright: the direction that reads the most text wins; 0 when none reads any. */
export async function uprightTurns(worker: Worker, page: Blob): Promise<number> {
  const bitmap = await createImageBitmap(page);
  const scale = Math.min(1, sampleLongSide / Math.max(bitmap.width, bitmap.height));
  const [width, height] = [Math.round(bitmap.width * scale), Math.round(bitmap.height * scale)];
  let best = { turns: 0, score: 0 };
  for (let turns = 0; turns < 4; turns++) {
    const sideways = turns % 2 === 1;
    const canvas = new OffscreenCanvas(sideways ? height : width, sideways ? width : height);
    const context = canvas.getContext("2d")!;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(turns * Math.PI / 2);
    context.drawImage(bitmap, -width / 2, -height / 2, width, height);
    const score = await readingScore(worker, await canvas.convertToBlob({ type: "image/png" }));
    if (score > best.score) best = { turns, score };
  }
  bitmap.close();
  return best.turns;
}

/** How much text a direction reads: confidence × characters, summed over the lines, as on the Mac. */
export async function readingScore(worker: Worker, image: Blob | Uint8Array): Promise<number> {
  const { data } = await worker.recognize(image as Blob, {}, { blocks: true });
  return linesOf(data.blocks).reduce((sum, line) => sum + line.confidence / 100 * line.text.trim().length, 0);
}

/** The lines of the page as drawn, erasing included: an erased text never enters the PDF. */
export async function readLines(worker: Worker, page: Blob | Uint8Array, width: number, height: number): Promise<TextLine[]> {
  const { data } = await worker.recognize(page as Blob, {}, { blocks: true });
  return linesOf(data.blocks)
    .filter((line) => line.text.trim() !== "")
    .map(({ text, bbox, confidence }) => ({
      text: text.trim(),
      box: { x: bbox.x0 / width, y: bbox.y0 / height, width: (bbox.x1 - bbox.x0) / width, height: (bbox.y1 - bbox.y0) / height },
      confidence: confidence / 100,
    }))
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
}

type Blocks = Awaited<ReturnType<Worker["recognize"]>>["data"]["blocks"];
const linesOf = (blocks: Blocks) => (blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines));
