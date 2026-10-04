// The site serves the Scanner's engines itself: OpenCV.js, and libheif for iPhone photos, copied into public/scan.
// libheif is LGPL: served as its own files, it stays replaceable.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const out = new URL("../public/scan/", import.meta.url).pathname;
const libheif = join(dirname(require.resolve("libheif-js/package.json")), "libheif-wasm");

mkdirSync(out, { recursive: true });
copyFileSync(require.resolve("@techstark/opencv-js"), join(out, "opencv.js"));
copyFileSync(join(libheif, "libheif.js"), join(out, "libheif.js"));
copyFileSync(join(libheif, "libheif.wasm"), join(out, "libheif.wasm"));
