import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { cast, titleEmoji } from "../cast";
import type { EngineError, NamedBytes } from "../engine/types";
import type { Dictionary, MonkTexts } from "../i18n/fr";
import { titleFor } from "../i18n/titles";
import { Icon } from "../illustrations/Icon";
import { Monk } from "../illustrations/Monk";
import type { Lang, Tool } from "../tools";
import { deliveryOf, type SaveOutcome, type Saver, shareFiles, thisDevice } from "./deliver";
import { engine } from "./engine";
import { docxType, type Made } from "./flow";
import { PagePreview, type Sheet } from "./PagePreview";
import { formatSize } from "./size";

type Props = { tool: Tool; t: Dictionary; lang: Lang; made: Made; saver: Saver; onSaved: () => void; onBack: () => void; onAgain: () => void };

export function Result({ tool, t, lang, made, saver, onSaved, onBack, onAgain }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ sheets: Sheet[]; index: number } | null>(null);
  const [viewing, setViewing] = useState(false);
  const opened = useRef<string[]>([]);
  const gone = useRef(false);
  useLayoutEffect(() => heading.current?.focus(), []);
  useEffect(
    () => () => {
      gone.current = true;
      closeOpened();
    },
    [],
  );
  const monk = cast[tool.id];
  const kind = made.type === "image/jpeg" ? "images" : made.type === docxType ? "word" : "pdf";
  const [single] = made.files;
  const saving = saver.kind === "save";
  const delivery = saving ? (made.files.length === 1 ? "one" : "zip") : deliveryOf(made.files.length, made.type, thisDevice());
  const savedPath = outcome?.kind === "saved" ? outcome.path : null;
  // The dictionary keeps each monk's own literal type: read them all as MonkTexts to give `result` its two arguments.
  const texts: MonkTexts = t.monks[tool.id];
  const title = titleFor(texts.result, made.count, made.files.length);
  const label = saving ? t.flow.save
    : delivery === "one" ? t.flow.downloadOne[kind] : delivery === "share" ? t.flow.saveMany[kind](made.files.length) : t.flow.downloadMany[kind](made.files.length);

  async function deliver() {
    setBusy(true);
    setError(null);
    setFailure(null);
    try {
      if (delivery === "share" && (await shareFiles(made.files, made.type))) return onSaved();
      const target = delivery === "one" && single ? { bytes: single.bytes, name: single.name, type: made.type } : await zipped();
      if (!target) return;
      const result = await saver.save(target.bytes, target.name, target.type);
      if (result.kind === "cancelled") return;
      setOutcome(result);
      onSaved();
    } catch (problem) {
      setFailure(reasonOf(problem));
    } finally {
      setBusy(false);
    }
  }

  function attempt(action: Promise<void>) {
    setFailure(null);
    action.catch((problem: unknown) => setFailure(reasonOf(problem)));
  }

  async function zipped() {
    const zip = await engine.zip(made.files);
    if (zip.ok) return { bytes: zip.value, name: made.zipName, type: "application/zip" };
    setError(zip.error);
    return null;
  }

  function closeOpened() {
    for (const docId of opened.current) engine.close(docId);
    opened.current = [];
  }

  /** The files just made, reopened in the engine for the time of the preview; the images as they are. */
  async function view() {
    setViewing(true);
    setError(null);
    setFailure(null);
    try {
      const sheets: Sheet[] = [];
      for (const [position, file] of made.files.entries()) {
        // Unmounted while opening: the cleanup closed what was open, the rest must not open.
        if (gone.current) return;
        if (made.type === "image/jpeg") {
          sheets.push({ key: `${position}:${file.name}`, label: file.name, rotation: 0, render: async () => new Blob([file.bytes], { type: made.type }) });
          continue;
        }
        const docId = `result-${crypto.randomUUID()}`;
        opened.current.push(docId);
        const result = await engine.open(docId, new File([file.bytes], file.name, { type: made.type }), "pdf", made.password);
        if (gone.current) return;
        if (!result.ok) {
          closeOpened();
          setError(result.error);
          return;
        }
        result.value.forEach((size, index) =>
          sheets.push({
            key: `${docId}:${index}`,
            label: made.files.length > 1 ? t.board.pageOfFile(file.name, index + 1) : t.board.page(index + 1),
            rotation: 0,
            size,
            render: (width) => engine.thumbnail(docId, index, width).then((rendered) => (rendered.ok ? rendered.value : null)),
          }),
        );
      }
      setPreview({ sheets, index: 0 });
    } finally {
      setViewing(false);
    }
  }

  const { open, reveal } = saver;

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
            {made.type !== docxType && (
              <button type="button" disabled={viewing} onClick={() => void view()}>
                <Icon name="view" size={18} />
                {t.flow.view}
              </button>
            )}
            {savedPath && open && (
              <button type="button" onClick={() => attempt(open(savedPath))}>
                <Icon name="view" size={18} />
                {t.flow.open}
              </button>
            )}
            {savedPath && reveal && (
              <button type="button" onClick={() => attempt(reveal(savedPath))}>
                {t.flow.reveal[saver.platform ?? "linux"]}
              </button>
            )}
          </div>
          {failure ? (
            <p class="hint" role="alert">
              {t.flow.saveFailed} {failure}
            </p>
          ) : error ? (
            <p class="hint" role="alert">
              {t.errors[error.kind]}
            </p>
          ) : savedPath ? (
            <p class="hint">{t.flow.saved} · {savedPath.split(/[\\/]/).pop()}</p>
          ) : (
            delivery !== "one" && <p class="hint">{delivery === "share" ? t.flow.shareHint : t.flow.zipHint[kind]}</p>
          )}
        </div>
      </div>
      <button type="button" class="again" onClick={onAgain}>
        <Icon name="again" size={18} />
        {texts.again}
      </button>
      <PagePreview
        sheets={preview?.sheets ?? []}
        index={preview?.index ?? null}
        onIndex={(index) => {
          if (index === null) closeOpened();
          setPreview(index === null ? null : preview && { ...preview, index });
        }}
        t={t}
      />
    </section>
  );
}

const reasonOf = (problem: unknown) => (problem instanceof Error ? problem.message : String(problem));

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
