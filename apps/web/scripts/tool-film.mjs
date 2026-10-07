import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

const [id, ...pairs] = process.argv.slice(2);
const sources = Object.fromEntries(pairs.map((pair) => pair.split("=")));
if (!id || pairs.length === 0 || Object.values(sources).some((source) => !source)) {
  console.error("Usage: node scripts/tool-film.mjs <tool-id> <lang>=<render.mp4> [<lang>=<render.mp4>…]");
  process.exit(1);
}
const out = new URL("../public/videos/tools/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });

for (const [lang, source] of Object.entries(sources)) {
  // 720p at 30 fps keeps the texts sharp at a fifteenth of the 1080p 60 fps render's weight.
  ffmpeg("-i", source, "-vf", "scale=720:1280:flags=lanczos,fps=30", "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", `${out}${id}-${lang}.mp4`);
}
const [firstLang, firstSource] = Object.entries(sources)[0];
if (!existsSync(`${out}${id}.webp`)) ffmpeg("-ss", "4", "-i", firstSource, "-frames:v", "1", "-vf", "crop=iw:iw:0:ih*0.3,scale=96:96", "-c:v", "libwebp", "-quality", "80", `${out}${id}.webp`);
const seconds = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `${out}${id}-${firstLang}.mp4`]).toString();
console.log(`${id}: ${Math.round(Number(seconds))} s. Add the languages to toolFilms in src/films.ts.`);
