import { cast } from "../cast";
import type { Dictionary } from "../i18n/fr";
import { Monk } from "../illustrations/Monk";
import { type ToolId, tools } from "../tools";
import { type Bubble, moodOf } from "./bubble";

type Props = { toolId: ToolId; bubble: Bubble; t: Dictionary };

export function MonkBubble({ toolId, bubble, t }: Props) {
  const monk = cast[toolId];
  return (
    <div class="monk-bubble">
      <span class="monk-disc" style={`background: var(--${monk.category}-tint)`}>
        <Monk accessory={monk.accessory} mood={moodOf(bubble)} size={76} />
      </span>
      <div class="bubble">
        <strong class="bubble-name">{t.monks[toolId].name}</strong>
        {/* A polite live region, not role="status": dnd-kit's announcer must stay the only status on the page. */}
        <p class="bubble-text" aria-live="polite">
          {sentence(toolId, bubble, t)}
        </p>
      </div>
    </div>
  );
}

function sentence(toolId: ToolId, bubble: Bubble, t: Dictionary): string {
  const monk = t.monks[toolId];
  switch (bubble.say) {
    case "reading":
      return t.bubble.reading(bubble.name);
    case "ready": {
      const counts = tools[toolId].accepts === "image" ? t.bubble.images(bubble.pages) : t.bubble.counts(bubble.files, bubble.pages);
      return `${counts} ${monk.hint}`;
    }
    case "working":
      return monk.working;
    case "failed":
      return t.errors[bubble.error.kind];
  }
}
