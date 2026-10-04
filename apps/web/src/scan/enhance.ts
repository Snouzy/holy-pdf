import { type CV, type Mat, using } from "./cv";

export type RenderMode = "document" | "color";
/** `keepWatermark` undefined: detected on the page. */
export type EnhanceSettings = { mode: RenderMode; keepWatermark?: boolean | undefined };

const border = 24;
/** Stands in for the prototype's 21 px median, as on the Mac. */
const smoothingSigma = 5;
const fillThreshold = 0.08;
const minCoverage = 0.024;

/**
 * The upright page (RGBA) cleaned for print. The math runs on gamma-encoded sRGB values, like the prototype, so its
 * thresholds carry over. `keepWatermark` says what was applied: the setting, or the detection in Document mode.
 */
export function enhance(cv: CV, page: Mat, settings: EnhanceSettings): { image: Mat; keepWatermark: boolean } {
  const rgb = new cv.Mat();
  cv.cvtColor(page, rgb, cv.COLOR_RGBA2RGB);
  return using([rgb], () => {
    if (settings.mode === "color") return { image: color(cv, rgb), keepWatermark: false };
    return document(cv, rgb, settings.keepWatermark);
  });
}

function document(cv: CV, page: Mat, keep: boolean | undefined): { image: Mat; keepWatermark: boolean } {
  const fine = octagonMaximum(cv, page, 7);
  const quarter = new cv.Size(Math.max(1, Math.round(page.cols / 4)), Math.max(1, Math.round(page.rows / 4)));
  const [fineSmall, closedSmall, shadeSmall] = [new cv.Mat(), new cv.Mat(), new cv.Mat()];
  // The large morphology runs at a quarter of the size: at full size, a 91 px disk would take seconds in WebAssembly.
  cv.resize(fine, fineSmall, quarter, 0, 0, cv.INTER_AREA);
  closing(cv, fineSmall, closedSmall, 11);
  shade(cv, closedSmall, shadeSmall);
  const keepWatermark = keep ?? coverage(fineSmall, closedSmall, shadeSmall) > minCoverage;
  const paper = new cv.Mat();
  return using([fine, fineSmall, closedSmall, shadeSmall, paper], () => {
    if (keepWatermark) {
      // The closing fills the watermark strokes so they are not divided out. Inside a shadow it also fills the narrow
      // streak between two shadow lobes, so there the fine estimate wins.
      const [closed, mask] = [new cv.Mat(), new cv.Mat()];
      using([closed, mask], () => {
        cv.resize(closedSmall, closed, page.size(), 0, 0, cv.INTER_LINEAR);
        cv.resize(shadeSmall, mask, page.size(), 0, 0, cv.INTER_LINEAR);
        blend(fine, closed, mask, paper);
      });
    } else {
      fine.copyTo(paper);
    }
    // The paper estimate is smooth: blurred at half the size, it takes a quarter of the time.
    const half = new cv.Mat();
    using([half], () => {
      cv.resize(paper, half, new cv.Size(Math.max(1, Math.round(paper.cols / 2)), Math.max(1, Math.round(paper.rows / 2))), 0, 0, cv.INTER_AREA);
      cv.GaussianBlur(half, half, new cv.Size(0, 0), smoothingSigma / 2);
      cv.resize(half, paper, paper.size(), 0, 0, cv.INTER_LINEAR);
    });
    const leveled = divided(cv, page, paper);
    const [blurred, out] = [new cv.Mat(), new cv.Mat()];
    return using([leveled, blurred], () => {
      cv.GaussianBlur(leveled, blurred, new cv.Size(0, 0), 1.2);
      cv.addWeighted(leveled, 1.5, blurred, -0.5, 0, leveled);
      const white = new cv.Scalar(255, 255, 255);
      for (const [x, y, width, height] of [[0, 0, leveled.cols, border], [0, leveled.rows - border, leveled.cols, border], [0, 0, border, leveled.rows], [leveled.cols - border, 0, border, leveled.rows]]) {
        cv.rectangle(leveled, new cv.Point(x!, y!), new cv.Point(x! + width! - 1, y! + height! - 1), white, -1);
      }
      cv.cvtColor(leveled, out, cv.COLOR_RGB2RGBA);
      return { image: out, keepWatermark };
    });
  });
}

/**
 * The paper without the ink: a maximum over a disk removes strokes thinner than the disk. A square of radius 3 then four
 * steps of a cross make an octagon of radius `radius` (7) that stays within 0.1 px of the disk: ten times faster.
 */
function octagonMaximum(cv: CV, image: Mat, radius: number): Mat {
  const steps = Math.round(radius * 4 / 7);
  const out = new cv.Mat();
  const [square, cross] = [cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2 * (radius - steps) + 1, 2 * (radius - steps) + 1)), cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3))];
  return using([square, cross], () => {
    cv.dilate(image, out, square, new cv.Point(-1, -1), 1, cv.BORDER_REPLICATE);
    cv.dilate(out, out, cross, new cv.Point(-1, -1), steps, cv.BORDER_REPLICATE);
    return out;
  });
}

function closing(cv: CV, image: Mat, out: Mat, radius: number): void {
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2 * radius + 1, 2 * radius + 1));
  using([kernel], () => cv.morphologyEx(image, out, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 1, cv.BORDER_REPLICATE));
}

/**
 * At a quarter of the size, 0 to 255: 255 where the paper lies in a shadow, compared with the lit paper within about
 * 200 px. (0.92 · lit − gray) / (0.1 · lit) = 9.2 − 10 · gray / lit. A square stands in for the Mac's disk: a 101 px disk
 * is slow, and the lit paper is blurred right after.
 */
function shade(cv: CV, closedSmall: Mat, out: Mat): void {
  const [gray, lit] = [grayMean(cv, closedSmall), new cv.Mat()];
  const square = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(101, 101));
  using([gray, lit, square], () => {
    cv.dilate(gray, lit, square, new cv.Point(-1, -1), 1, cv.BORDER_REPLICATE);
    cv.GaussianBlur(lit, lit, new cv.Size(0, 0), 10);
    out.create(gray.rows, gray.cols, cv.CV_8UC1);
    const [values, lights, mask] = [gray.data, lit.data, out.data];
    for (let index = 0; index < values.length; index++) {
      const share = 9.2 - 10 * values[index]! / Math.max(lights[index]!, 1);
      mask[index] = Math.round(255 * Math.min(1, Math.max(0, share)));
    }
    cv.GaussianBlur(out, out, new cv.Size(0, 0), 2.5);
  });
}

function grayMean(cv: CV, rgb: Mat): Mat {
  const gray = new cv.Mat(rgb.rows, rgb.cols, cv.CV_8UC1);
  const [from, to] = [rgb.data, gray.data];
  for (let index = 0; index < to.length; index++) to[index] = Math.round((from[index * 3]! + from[index * 3 + 1]! + from[index * 3 + 2]!) / 3);
  return gray;
}

/** Share of the page interior (10 % margins left out) that the closing fills, outside shadows. */
function coverage(fineSmall: Mat, closedSmall: Mat, shadeSmall: Mat): number {
  const [width, height] = [fineSmall.cols, fineSmall.rows];
  const [fine, closed, shaded] = [fineSmall.data, closedSmall.data, shadeSmall.data];
  let [filled, total] = [0, 0];
  for (let y = Math.floor(0.1 * height); y < Math.floor(0.9 * height); y++) {
    for (let x = Math.floor(0.1 * width); x < Math.floor(0.9 * width); x++) {
      const at = y * width + x;
      total++;
      const gap = (closed[at * 3]! + closed[at * 3 + 1]! + closed[at * 3 + 2]! - fine[at * 3]! - fine[at * 3 + 1]! - fine[at * 3 + 2]!) / (3 * 255);
      if (shaded[at]! < 128 && gap > fillThreshold) filled++;
    }
  }
  return total > 0 ? filled / total : 0;
}

function blend(fine: Mat, closed: Mat, mask: Mat, out: Mat): void {
  fine.copyTo(out);
  const [a, b, m, o] = [fine.data, closed.data, mask.data, out.data];
  for (let index = 0; index < m.length; index++) {
    const weight = m[index]! / 255;
    for (let channel = 0; channel < 3; channel++) {
      const at = index * 3 + channel;
      o[at] = Math.round(weight * a[at]! + (1 - weight) * b[at]!);
    }
  }
}

function divided(cv: CV, page: Mat, paper: Mat): Mat {
  const out = new cv.Mat(page.rows, page.cols, page.type());
  const [ink, light, result] = [page.data, paper.data, out.data];
  for (let index = 0; index < result.length; index++) {
    const value = ink[index]! / Math.max(light[index]!, 1);
    const leveled = Math.min(1, Math.max(0, (value - 0.12) / (0.86 - 0.12)));
    result[index] = Math.round(255 * leveled ** 1.35);
  }
  return out;
}

/** Security backgrounds and photos: each channel stretched between its 0.5 and 99 percentiles. */
function color(cv: CV, page: Mat): Mat {
  const small = new cv.Mat();
  const factor = Math.min(1, 512 / Math.max(page.cols, page.rows));
  cv.resize(page, small, new cv.Size(Math.max(1, Math.round(page.cols * factor)), Math.max(1, Math.round(page.rows * factor))), 0, 0, cv.INTER_AREA);
  const tables = using([small], () => [0, 1, 2].map((channel) => {
    const values = Uint8Array.from({ length: small.data.length / 3 }, (_, index) => small.data[index * 3 + channel]!).sort();
    const [low, high] = [values[Math.floor(0.005 * (values.length - 1))]!, values[Math.floor(0.99 * (values.length - 1))]!];
    return Uint8Array.from({ length: 256 }, (_, value) => Math.round(255 * Math.min(1, Math.max(0, (value - low) / Math.max(high - low, 0.255)))));
  }));
  const [stretched, out] = [new cv.Mat(page.rows, page.cols, page.type()), new cv.Mat()];
  const [from, to] = [page.data, stretched.data];
  for (let index = 0; index < to.length; index++) to[index] = tables[index % 3]![from[index]!]!;
  return using([stretched], () => {
    cv.cvtColor(stretched, out, cv.COLOR_RGB2RGBA);
    return out;
  });
}
