import { cast } from "../cast";
import type { Dictionary } from "../i18n/fr";
import { Icon } from "../illustrations/Icon";
import { Monk } from "../illustrations/Monk";
import type { Tool } from "../tools";
import { FilePicker } from "./FilePicker";

type Props = { tool: Tool; t: Dictionary; onFiles: (files: File[]) => void };

export function DropZone({ tool, t, onFiles }: Props) {
  const monk = cast[tool.id];
  const label = tool.accepts === "photo" ? t.drop.choosePhotos : tool.accepts === "image" ? t.drop.chooseImages : tool.multipleFiles ? t.drop.choosePdfs : t.drop.choosePdf;
  return (
    <div class="dropzone" style={`--tool: var(--${monk.category}); --tool-tint: var(--${monk.category}-tint)`}>
      <div class="dropzone-card">
        <span class="dropzone-monk">
          <Monk accessory={monk.accessory} mood={monk.mood} size={130} />
        </span>
        <FilePicker tool={tool} label={label} icon="upload" onFiles={onFiles} />
        {tool.accepts === "photo" && <FilePicker tool={tool} label={t.drop.takePhoto} onFiles={onFiles} camera class="camera-only secondary" />}
        <p class="dropzone-hint">{tool.multipleFiles ? t.drop.orDropThem : t.drop.orDropIt}</p>
      </div>
      <p class="dropzone-trust">
        <Icon name="lock" size={16} />
        {t.drop.trust}
      </p>
    </div>
  );
}
