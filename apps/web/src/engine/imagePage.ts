/** A4 in PDF points. */
export const a4 = { width: 595.28, height: 841.89 };

export type ImagePlacement = { pageWidth: number; pageHeight: number; x: number; y: number; width: number; height: number };

export function placeOnA4(pixelWidth: number, pixelHeight: number): ImagePlacement {
  const landscape = pixelWidth > pixelHeight;
  const pageWidth = landscape ? a4.height : a4.width;
  const pageHeight = landscape ? a4.width : a4.height;
  const scale = Math.min(pageWidth / pixelWidth, pageHeight / pixelHeight);
  const width = pixelWidth * scale;
  const height = pixelHeight * scale;
  return { pageWidth, pageHeight, x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height };
}
