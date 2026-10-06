import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { toolFilm, toolFilms } from "../../src/films";
import { languages, type ToolId } from "../../src/tools";

it("finds the files of every tool film", () => {
  const publicDir = join(import.meta.dirname, "../../public");
  for (const id of Object.keys(toolFilms) as ToolId[]) {
    for (const lang of languages) {
      const film = toolFilm(id, lang);
      if (film) for (const file of [film.src, film.thumb]) expect(existsSync(join(publicDir, file)), file).toBe(true);
    }
  }
});
