import type { Lang } from "../../web/src/tools";

declare global {
  interface Window {
    __HOLY__?: { lang: string; os: string };
  }
}

export type Platform = "mac" | "windows" | "linux";

const given = window.__HOLY__ ?? { lang: navigator.language, os: "" };

/** The app speaks French and English for now: its menus in lib.rs have no other language yet. */
export type AppLang = Extract<Lang, "fr" | "en">;

export const lang: AppLang = given.lang.toLowerCase().startsWith("fr") ? "fr" : "en";
export const platform: Platform = given.os === "macos" ? "mac" : given.os === "windows" ? "windows" : "linux";
export const inTauri = "__TAURI_INTERNALS__" in window;
