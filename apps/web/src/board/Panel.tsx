import type { ComponentChildren, RefObject } from "preact";
import type { Dictionary } from "../i18n/fr";
import { Icon } from "../illustrations/Icon";
import type { Tool } from "../tools";
import type { Bubble } from "./bubble";
import { type Flow, percentDone } from "./flow";
import { MonkBubble } from "./MonkBubble";

type Props = {
  tool: Tool;
  t: Dictionary;
  bubble: Bubble;
  flow: Flow;
  ready: boolean;
  verb: RefObject<HTMLButtonElement>;
  onGo: () => void;
  children: ComponentChildren;
  beforeAction?: ComponentChildren;
};

/** The monk, the tool's options, and one button that says what it will do, then how far it got. */
export function Panel({ tool, t, bubble, flow, ready, verb, onGo, children, beforeAction }: Props) {
  const percent = percentDone(flow);
  return (
    <div class="panel">
      <div class="panel-content">
        <MonkBubble toolId={tool.id} bubble={bubble} t={t} />
        <div class="options">{children}</div>
      </div>
      <div class="go">
        {beforeAction}
        {flow.step === "working" ? (
          <div
            class="verb progress"
            role="progressbar"
            aria-label={t.monks[tool.id].working}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            style={`--done: ${percent}%`}
          >
            {t.flow.progress(percent)}
          </div>
        ) : (
          <button ref={verb} type="button" class="verb" disabled={!ready} onClick={onGo}>
            {t.monks[tool.id].verb}
            <Icon name="arrow" size={20} />
          </button>
        )}
        <p class="trust">
          <Icon name="lock" size={14} />
          {t.toolPage.privacy}
        </p>
      </div>
    </div>
  );
}
