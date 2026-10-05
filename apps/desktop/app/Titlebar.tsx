import { useState } from "preact/hooks";
import { dictionaries, searchTexts } from "../../web/src/i18n";
import { Icon } from "../../web/src/illustrations/Icon";
import type { ToolId } from "../../web/src/tools";
import { lang } from "./shell";
import { texts } from "./texts";

type Props = { tool: ToolId | null; query: string; onQuery: (query: string) => void; onHome: () => void; matches: ToolId[]; onOpen: (id: ToolId) => void };

export function Titlebar({ tool, query, onQuery, onHome, matches, onOpen }: Props) {
  const t = dictionaries[lang];
  const s = searchTexts[lang];
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const current = Math.min(active, Math.max(matches.length - 1, 0));
  const listed = tool && focused && matches.length > 0 ? matches : null;

  function keyed(event: KeyboardEvent) {
    const chosen = matches[current];
    if (event.key === "Enter" && chosen) onOpen(chosen);
    else if (event.key === "Escape") onQuery("");
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % Math.max(matches.length, 1));
    }
  }

  return (
    <header class="titlebar" data-tauri-drag-region="deep">
      {tool ? (
        <button type="button" class="back" onClick={onHome}>
          <Icon name="back" size={18} />
          {texts[lang].monastery}
        </button>
      ) : <span />}
      <span class="window-title">{tool ? t.toolNames[tool] : "Holy PDF"}</span>
      <div class="search">
        <input
          id="search"
          type="search"
          role="combobox"
          placeholder={s.label}
          aria-label={s.label}
          aria-expanded={listed !== null}
          aria-controls="palette"
          aria-activedescendant={listed ? `palette-${listed[current]}` : undefined}
          value={query}
          onInput={(event) => {
            setActive(0);
            onQuery(event.currentTarget.value);
          }}
          onKeyDown={keyed}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {listed && (
          <ul id="palette" class="palette" role="listbox">
            {listed.map((id, index) => (
              <li key={id} id={`palette-${id}`} role="option" aria-selected={index === current} onPointerDown={(event) => event.preventDefault()} onClick={() => onOpen(id)}>
                {t.toolNames[id]} <small>{t.monks[id].name}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
