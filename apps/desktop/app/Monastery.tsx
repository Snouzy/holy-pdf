import { byCategory, cast, upcoming, type UpcomingId } from "../../web/src/cast";
import type { Match } from "../../web/src/home/search";
import { dictionaries, searchTexts } from "../../web/src/i18n";
import { Monk } from "../../web/src/illustrations/Monk";
import { Scene } from "../../web/src/illustrations/Scene";
import { ToolIcon } from "../../web/src/illustrations/ToolIcon";
import { type ToolId, tools } from "../../web/src/tools";
import { accepted } from "./files";
import { isTool, labelOf } from "./search";
import { lang, platform } from "./shell";
import { texts } from "./texts";

type Props = { found: Match[] | null; arrived: File[]; onOpen: (id: ToolId) => void; onChangeFiles: () => void; onReset: () => void };

export function Monastery({ found, arrived, onOpen, onChangeFiles, onReset }: Props) {
  const t = dictionaries[lang];
  const s = searchTexts[lang];
  const a = texts[lang];
  const [before, highlight] = a.title[platform];

  function card(id: ToolId) {
    const monk = cast[id];
    const usable = arrived.length === 0 || accepted(tools[id], arrived).length > 0;
    return (
      <button key={id} type="button" class={usable ? "tool-card lift" : "tool-card"} data-tool={id} aria-disabled={usable ? undefined : "true"} style={`--scene-accent: var(--${monk.category}); --card-tint: var(--${monk.category}-tint)`} onClick={() => usable && onOpen(id)}>
        <span class="art">
          <span class="art-scene"><Scene kind={monk.scene} size={110} /></span>
          <span class="art-monk"><Monk accessory={monk.accessory} mood={monk.mood} size={112} /></span>
        </span>
        <span class="text">
          <span class="monk-name">{t.monks[id].name}</span>
          <strong>{t.toolNames[id]}</strong>
          <span class="line">{t.monks[id].line}</span>
        </span>
      </button>
    );
  }

  function asleep(id: UpcomingId) {
    return (
      <div key={id} class="tool-card asleep" style={`--scene-accent: var(--${upcoming[id].category})`}>
        <span class="art"><ToolIcon id={id} size={64} /></span>
        <span class="text">
          <span class="monk-name">{t.categories[upcoming[id].category]}</span>
          <strong>{t.upcoming[id]}</strong>
          <span class="tag">{s.soonTag}</span>
        </span>
      </div>
    );
  }

  return (
    <main class="monastery">
      <h1>
        {before}<span class="highlight">{highlight}</span>&nbsp;<span class="emoji" aria-hidden="true">🙏</span>
      </h1>
      <p class="promise">{a.trust}</p>
      {arrived.length > 0 && (
        <p class="arrived" role="status">
          {a.ready(arrived.length)} <button type="button" onClick={onChangeFiles}>{a.changeFiles}</button>
        </p>
      )}
      {!found ? (
        byCategory().map(({ category, ready, sleeping }) => (
          <section key={category}>
            <h2 style={`color: var(--${category})`}>{t.categories[category]}</h2>
            <div class="cards">{ready.map(card)}{sleeping.map(asleep)}</div>
          </section>
        ))
      ) : found.length === 0 ? (
        <div class="empty">
          <Monk accessory="loupe" mood="sleep" size={120} />
          <h2>{s.emptyTitle}</h2>
          <p>{s.emptyText}</p>
          <button type="button" onClick={onReset}>{s.reset}</button>
        </div>
      ) : (
        <section>
          <p class="status" aria-live="polite">
            {s.count(found.length)}
            {found[0]?.via ? ` · ${s.via(found[0].via, labelOf(found[0].id))}` : ""}
          </p>
          <div class="cards">{found.map((match) => (isTool(match.id) ? card(match.id) : asleep(match.id as UpcomingId)))}</div>
        </section>
      )}
    </main>
  );
}
