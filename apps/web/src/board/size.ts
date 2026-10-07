import { type Lang, locales } from "../tools";

/** Decimal units, as the macOS Finder shows them: "184 Ko", "1,2 Mo". */
export function formatSize(bytes: number, lang: Lang, units: { kilo: string; mega: string }): string {
  const number = new Intl.NumberFormat(locales[lang], { maximumFractionDigits: 1 });
  if (bytes < 1_000_000) return `${number.format(Math.max(1, Math.round(bytes / 1000)))} ${units.kilo}`;
  return `${number.format(bytes / 1_000_000)} ${units.mega}`;
}
