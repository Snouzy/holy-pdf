import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { toolPath } from "./site";
import { articlePath, pageIds, pagePath, type Section } from "./sitePages";
import { languages, toolIds, tools } from "./tools";

const field = (markdown: string, name: string) => new RegExp(`^${name}: (\\S+)$`, "m").exec(markdown.slice(0, markdown.indexOf("\n---", 3)))?.[1];

/** The last commit that touched each Markdown file under `root`, by path relative to it. Empty without a full git history. */
function committed(root: string): Map<string, string> {
  const dates = new Map<string, string>();
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try {
    if (git("rev-parse", "--is-shallow-repository") === "true") throw new Error("shallow clone");
    const prefix = git("rev-parse", "--show-prefix");
    let date = "";
    for (const line of git("log", "--format=%cI", "--name-only", "--", ".").split("\n")) {
      if (/^\d{4}-/.test(line)) date = new Date(line).toISOString();
      else if (line.startsWith(prefix) && !dates.has(line.slice(prefix.length))) dates.set(line.slice(prefix.length), date);
    }
  } catch (error) {
    console.warn(`lastmod: ${error instanceof Error ? error.message : error}; the sitemap carries only the dates the content declares.`);
  }
  return dates;
}

/** When each page last changed, by path: the date its Markdown declares (`updated`, else `published`), otherwise the last commit that touched the file. The homes have no date. */
export function lastModified(root: string): Map<string, string> {
  const commits = committed(root);
  const dates = new Map<string, string>();
  const add = (file: string, path: (markdown: string) => string) => {
    const markdown = readFileSync(join(root, file), "utf8");
    const date = field(markdown, "updated") ?? field(markdown, "published") ?? commits.get(file);
    if (date) dates.set(path(markdown), date);
  };
  for (const lang of languages) {
    for (const id of toolIds) add(`tools/${lang}/${id}.md`, () => toolPath(tools[id], lang));
    for (const id of pageIds) add(`pages/${lang}/${id}.md`, () => pagePath(id, lang));
    for (const file of readdirSync(join(root, "articles", lang))) {
      add(`articles/${lang}/${file}`, (markdown) => articlePath(field(markdown, "section") as Section, field(markdown, "slug") ?? "", lang));
    }
  }
  return dates;
}
