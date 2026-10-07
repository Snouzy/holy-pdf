import Board from "../../web/src/board/Board";
import { cast } from "../../web/src/cast";
import { dictionaries } from "../../web/src/i18n";
import { perLanguage, type ToolId } from "../../web/src/tools";
import { saver } from "./saver";
import { lang } from "./shell";

export function ToolScreen({ id, files }: { id: ToolId; files: File[] | undefined }) {
  const t = dictionaries[lang];
  return (
    <main class="tool-screen">
      <div class="tool-head">
        <h1>
          {t.toolNames[id]}&nbsp;<span class="emoji" aria-hidden="true">{cast[id].emoji}</span>
        </h1>
        <p class="intro">{t.monks[id].intro}</p>
      </div>
      <Board toolId={id} lang={lang} monks={perLanguage((code) => dictionaries[code].monks[id])} {...(files ? { files } : {})} saver={saver} />
    </main>
  );
}
