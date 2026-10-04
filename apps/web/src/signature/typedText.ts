import type { SignatureImage } from "../engine/types";
import { SignatureInputError, signatureSize } from "./geometry";
import { drawingImage } from "./image";

export type SignatureTextStyle = "handwritten" | "simple";
export const maxSignatureTextLength = 120;
export const signatureTextFamilies = { handwritten: "Holy PDF Handwriting", simple: "Figtree Variable" };
let handwriting: Promise<FontFace> | undefined;

export async function loadSignatureTextFont(style: SignatureTextStyle): Promise<void> {
  if (style === "handwritten") {
    handwriting ??= new FontFace(signatureTextFamilies.handwritten, 'url("/fonts/signature/caveat-latin-400.woff2")', { weight: "400" }).load()
      .then((face) => { document.fonts.add(face); return face; })
      .catch((cause) => { handwriting = undefined; throw cause; });
    await handwriting;
  } else {
    // The site's own font: if it failed to load, the page already shows its fallback, and the text does too.
    await document.fonts.load(fontOf("simple"), "Abé").catch(() => []);
  }
}

export function normalizedSignatureText(value: string): string {
  return Array.from(value.normalize("NFC").replace(/[\r\n\t]+/g, " ")).slice(0, maxSignatureTextLength).join("").trim();
}

export function renderSignatureText(canvas: HTMLCanvasElement, value: string, style: SignatureTextStyle): SignatureImage {
  const text = normalizedSignatureText(value);
  if (!text) throw new SignatureInputError("empty");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || context.isContextLost?.()) throw new SignatureInputError("decode");
  const font = fontOf(style);
  context.font = font;
  const metrics = context.measureText(text);
  const left = Math.max(0, metrics.actualBoundingBoxLeft);
  const ascent = Math.max(0, metrics.actualBoundingBoxAscent);
  const width = Math.ceil(left + Math.max(metrics.width, metrics.actualBoundingBoxRight)) + 32;
  const height = Math.ceil(ascent + Math.max(0, metrics.actualBoundingBoxDescent)) + 32;
  const size = signatureSize(width, height);
  canvas.width = size.width; canvas.height = size.height;
  const scale = Math.min(size.width / width, size.height / height);
  context.scale(scale, scale);
  context.font = font; context.fillStyle = "#141A2E";
  context.fillText(text, left + 16, ascent + 16);
  if (context.isContextLost?.()) throw new SignatureInputError("decode");
  const image = drawingImage(canvas);
  canvas.width = image.width; canvas.height = image.height;
  context.putImageData(new ImageData(image.pixels, image.width, image.height), 0, 0);
  return image;
}

function fontOf(style: SignatureTextStyle): string {
  return style === "simple" ? `400 96px "${signatureTextFamilies.simple}", sans-serif` : `400 96px "${signatureTextFamilies.handwritten}"`;
}
