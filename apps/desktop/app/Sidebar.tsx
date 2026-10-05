import { byCategory } from "../../web/src/cast";
import { dictionaries } from "../../web/src/i18n";
import { Avatar } from "../../web/src/illustrations/Avatar";
import { ToolIcon } from "../../web/src/illustrations/ToolIcon";
import type { ToolId } from "../../web/src/tools";
import { lang } from "./shell";
import { texts } from "./texts";

type Props = { tool: ToolId | null; onOpen: (id: ToolId) => void; onHome: () => void };

/** The Mac's source list: the monastery, then every monk under his category, the open one lit. */
export function Sidebar({ tool, onOpen, onHome }: Props) {
  const t = dictionaries[lang];
  const a = texts[lang];
  return (
    <nav class="sidebar" aria-label={a.tools}>
      <button type="button" class={tool === null ? "home current" : "home"} aria-current={tool === null ? "page" : undefined} onClick={onHome}>
        <Avatar accessory="none" mood="happy" diameter={22} tint="var(--organize-tint)" />
        {a.monastery}
      </button>
      {byCategory().map(({ category, ready, sleeping }) => (
        <section key={category}>
          <h2 style={`color: var(--${category})`}>{t.categories[category]}</h2>
          <ul>
            {ready.map((id) => (
              <li key={id}>
                <button type="button" data-tool={id} class={id === tool ? "current" : undefined} aria-current={id === tool ? "page" : undefined} onClick={() => onOpen(id)}>
                  <ToolIcon id={id} size={18} />
                  {t.toolShort[id]}
                </button>
              </li>
            ))}
            {sleeping.map((id) => (
              <li key={id} class="asleep">
                <ToolIcon id={id} size={18} />
                <span>{t.upcoming[id]}</span>
                <small>{a.soon}</small>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
