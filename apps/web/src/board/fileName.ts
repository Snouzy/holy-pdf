export function baseName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]*$/, "").trim();
  return stem === "" ? "document" : stem;
}

export function outputName(firstFileName: string, suffix: string, extension: "pdf" | "zip"): string {
  return `${baseName(firstFileName)}-${suffix}.${extension}`;
}

export function partName(firstFileName: string, part: number): string {
  return `${baseName(firstFileName)}-${part}.pdf`;
}

/** "scan", "scan" → "scan", "scan-2": a `.zip` keeps only one file per name. */
export function distinct(stems: string[]): string[] {
  const taken = new Set(stems);
  const given = new Set<string>();
  return stems.map((stem) => {
    let name = stem;
    if (given.has(stem)) {
      let count = 2;
      while (taken.has(`${stem}-${count}`)) count++;
      name = `${stem}-${count}`;
      taken.add(name);
    }
    given.add(name);
    return name;
  });
}
