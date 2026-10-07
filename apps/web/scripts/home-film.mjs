import { execFileSync } from "node:child_process";

const [lang, source] = process.argv.slice(2);
if (!lang || !source) {
  console.error("Usage: node scripts/home-film.mjs <lang> <render.mp4>");
  process.exit(1);
}
const out = new URL("../public/videos/", import.meta.url).pathname;
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });

// 1080p at 30 fps, like the French and English films: about 5 MB for 30 s, loaded only after the click.
ffmpeg("-i", source, "-vf", "fps=30", "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", `${out}holy-pdf-${lang}.mp4`);
ffmpeg("-ss", "2.4", "-i", source, "-frames:v", "1", "-vf", "scale=1280:720", "-c:v", "libwebp", "-quality", "80", `${out}holy-pdf-${lang}.webp`);
console.log(`holy-pdf-${lang}: done. Add the language to films in src/films.ts.`);
