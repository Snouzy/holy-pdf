import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { cast, titleEmoji } from "../cast";
import type { EngineError, NamedBytes } from "../engine/types";
import type { Dictionary, MonkTexts } from "../i18n/fr";
import { titleFor } from "../i18n/titles";
import { Icon } from "../illustrations/Icon";
import { Monk } from "../illustrations/Monk";
import type { Lang, Tool } from "../tools";
import { deliveryOf, shareFiles, thisDevice } from "./deliver";
import { download } from "./download";
import { engine } from "./engine";
import { docxType, type Made } from "./flow";
import { formatSize } from "./size";

type Props = { tool: Tool; t: Dictionary; lang: Lang; made: Made; onBack: () => void; onAgain: () => void };

export function Result({ tool, t, lang, made, onBack, onAgain }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError | null>(null);
  useLayoutEffect(() => heading.current?.focus(), []);
  const monk = cast[tool.id];
  const kind = made.type === "image/jpeg" ? "images" : made.type === docxType ? "word" : "pdf";
  const [single] = made.files;
  const delivery = deliveryOf(made.files.length, made.type, thisDevice());
  // The dictionary keeps each monk's own literal type: read them all as MonkTexts to give `result` its two arguments.
  const texts: MonkTexts = t.monks[tool.id];
  const title = titleFor(texts.result, made.count, made.files.length);
  const label =
    delivery === "one" ? t.flow.downloadOne[kind] : delivery === "share" ? t.flow.saveMany[kind](made.files.length) : t.flow.downloadMany[kind](made.files.length);

  async function deliver() {
    setBusy(true);
    setError(null);
    try {
      if (delivery === "one" && single) return download(single.bytes, single.name, made.type);
      if (delivery === "share" && (await shareFiles(made.files, made.type))) return;
      const zip = await engine.zip(made.files);
      if (zip.ok) download(zip.value, made.zipName, "application/zip");
      else setError(zip.error);
    } finally {
      setBusy(false);
    }
  }

  function view() {
    if (!single) return;
    const url = URL.createObjectURL(new Blob([single.bytes], { type: made.type }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <section class="result">
      <button type="button" class="back" onClick={onBack}>
        <Icon name="back" size={18} />
        {tool.workspace === "files" ? t.flow.backToSettings : t.flow.backToPages}
      </button>
      <div class="result-card">
        <div class="result-monk" aria-hidden="true">
          <p class="bubble">
            {t.flow.done}
            {" "}
            <span class="emoji">{titleEmoji.done}</span>
          </p>
          <span class="result-disc" style={`background: var(--${monk.category}-tint)`}>
            <Monk accessory={monk.accessory} mood="joy" size={180} />
          </span>
        </div>
        <div class="result-text">
          <h2 ref={heading} tabIndex={-1}>
            {title.before}
            <span class="highlight">{title.highlight}</span>
            {title.after}
          </h2>
          <Proof t={t} lang={lang} made={made} />
          <div class="result-actions">
            <button type="button" class="primary" disabled={busy} onClick={() => void deliver()}>
              <Icon name="download" size={22} />
              {label}
            </button>
            {delivery === "one" && made.type === "application/pdf" && (
              <button type="button" onClick={view}>
                <Icon name="view" size={18} />
                {t.flow.view}
              </button>
            )}
          </div>
          {error ? (
            <p class="hint" role="alert">
              {t.errors[error.kind]}
            </p>
          ) : (
            delivery !== "one" && <p class="hint">{delivery === "share" ? t.flow.shareHint : t.flow.zipHint[kind]}</p>
          )}
        </div>
      </div>
      <button type="button" class="again" onClick={onAgain}>
        <Icon name="again" size={18} />
        {texts.again}
      </button>
    </section>
  );
}

/** What shows that the work was done: the images made, the weight before and after, or the file made. */
function Proof({ t, lang, made }: { t: Dictionary; lang: Lang; made: Made }) {
  if (made.type === "image/jpeg") return <Thumbs files={made.files} t={t} />;
  const meta = <p class="result-meta">{metaLine(made, t, lang)}</p>;
  return made.before > 0 ? (
    <>
      <SizeBars made={made} t={t} lang={lang} />
      {meta}
    </>
  ) : (
    meta
  );
}

function SizeBars({ made, t, lang }: { made: Made; t: Dictionary; lang: Lang }) {
  const after = Math.min(100, Math.max(2, Math.round((made.after / made.before) * 100)));
  return (
    <dl class="size-bars">
      <dt>{t.compress.before}</dt>
      <dd>
        <span class="track">
          <span class="bar" style="width: 100%" />
        </span>
        <strong>{formatSize(made.before, lang, t.sizes)}</strong>
      </dd>
      <dt>{t.compress.after}</dt>
      <dd>
        <span class="track">
          <span class="bar after" style={`width: ${after}%`} />
        </span>
        <strong>{formatSize(made.after, lang, t.sizes)}</strong>
      </dd>
    </dl>
  );
}

function Thumbs({ files, t }: { files: NamedBytes[]; t: Dictionary }) {
  const urls = useMemo(() => files.slice(0, 6).map((file) => URL.createObjectURL(new Blob([file.bytes], { type: "image/jpeg" }))), [files]);
  useEffect(
    () => () => {
      for (const url of urls) URL.revokeObjectURL(url);
    },
    [urls],
  );
  return (
    <ul class="result-thumbs">
      {urls.map((url) => (
        <li key={url}>
          <img src={url} alt="" />
        </li>
      ))}
      {files.length > urls.length && <li class="more">{t.flow.more(files.length - urls.length)}</li>}
    </ul>
  );
}

/** « a-merged.pdf · 12 pages · 2,4 Mo »: the name when one file was made, the pages when known, the weight. */
function metaLine(made: Made, t: Dictionary, lang: Lang): string {
  const [single] = made.files;
  const parts = [made.files.length === 1 && single ? single.name : null, made.pages > 0 ? t.board.pageCount(made.pages) : null, formatSize(made.after, lang, t.sizes)];
  return parts.filter((part) => part !== null).join(" · ");
}
