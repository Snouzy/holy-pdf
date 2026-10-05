import { render } from "preact";
import "../../web/src/styles/tokens.css";
import "../../web/src/styles/base.css";
import { fontFaces, preloadedFonts } from "../../web/src/styles/fonts";
import { App } from "./App";
import "./app.css";
import { lang, platform } from "./shell";

document.documentElement.lang = lang;
document.documentElement.classList.add(platform);
const dark = matchMedia("(prefers-color-scheme: dark)");
const followTheme = () => document.documentElement.setAttribute("data-theme", dark.matches ? "dark" : "light");
followTheme();
dark.addEventListener("change", followTheme);
for (const href of preloadedFonts) document.head.append(Object.assign(document.createElement("link"), { rel: "preload", as: "font", type: "font/woff2", href, crossOrigin: "" }));
document.head.append(Object.assign(document.createElement("style"), { textContent: fontFaces }));
render(<App />, document.getElementById("app")!);
