import { searchIndex } from "../../web/src/home/index";
import { type Match, searchTools } from "../../web/src/home/search";
import { type ToolId, toolIds } from "../../web/src/tools";
import { lang } from "./shell";

const index = searchIndex(lang);

export const labelOf = (id: string): string => index.find((entry) => entry.id === id)?.label ?? "";

export const isTool = (id: string): id is ToolId => (toolIds as readonly string[]).includes(id);

/** Null while the query says nothing yet: empty, or stop words only, which match every tool at score 0. The site keeps browsing then. */
export function findTools(query: string): Match[] | null {
  if (!query.trim()) return null;
  const matches = searchTools(query, index);
  return matches.length > 0 && matches.every((match) => match.score === 0) ? null : matches;
}
