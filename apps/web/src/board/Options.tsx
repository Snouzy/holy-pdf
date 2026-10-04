import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { CompressLevel, ImageMode, ImageQuality, NumberFormat, NumberPosition, PerSheet, HalfCut } from "../engine/types";
import type { Dictionary } from "../i18n/fr";
import { Icon } from "../illustrations/Icon";
import type { Tool } from "../tools";
import type { Action, Board } from "./state";

export type Settings = {
  mode: ImageMode; quality: ImageQuality; level: CompressLevel; password: string; confirm: string;
  numberFormat: NumberFormat; numberPosition: NumberPosition; firstNumber: number; numberSize: number; allPages: boolean; fromPage: number; toPage: number;
  markText: string; markColor: MarkColor; markOpacity: number; markAngle: number; markWidth: number;
  perSheet: PerSheet; halfCut: HalfCut; pixelPpi: 150 | 300;
  /** The PDF laid on the pages, open in the engine under its own id; kept from one document to the next. */
  layer: { docId: string; name: string; pages: number } | null; layerUnder: boolean;
};

/** « Up to the last page » until the visitor types an end: the page count may not be known yet. */
const lastPage = 9999;

export const defaultSettings: Settings = {
  mode: "pages", quality: "normal", level: "recommended", password: "", confirm: "",
  numberFormat: "number", numberPosition: "bottom-center", firstNumber: 1, numberSize: 12, allPages: true, fromPage: 1, toPage: lastPage,
  markText: "", markColor: "red", markOpacity: 30, markAngle: 45, markWidth: 60,
  perSheet: 4, halfCut: "vertical", pixelPpi: 150,
  layer: null, layerUnder: false,
};

export type MarkColor = "red" | "gray" | "blue";
export const markColors: Record<MarkColor, [number, number, number]> = { red: [200, 50, 27], gray: [90, 90, 90], blue: [36, 76, 200] };
/** Helvetica, PDFium's standard font, writes Latin-1 only. */
export const writable = (text: string) => /^[\x20-\x7E\xA0-\xFF]*$/.test(text);

export function optionsReady(tool: Tool, settings: Settings): boolean {
  if (tool.id === "watermark") return writable(settings.markText);
  if (tool.id === "overlay") return settings.layer !== null;
  return tool.id !== "protect" || (settings.password !== "" && settings.password === settings.confirm);
}

type Props = {
  tool: Tool;
  t: Dictionary;
  board: Board;
  dispatch: (action: Action) => void;
  settings: Settings;
  onSettings: (change: Partial<Settings>) => void;
  onLayer: (file: File) => void;
  layerError: string | null;
};

/** What a tool lets the visitor set before it runs. Most page tools have nothing here: the pages are the setting. */
export function Options({ tool, t, board, dispatch, settings, onSettings, onLayer, layerError }: Props) {
  switch (tool.id) {
    case "split":
      return <CutEvery t={t} dispatch={dispatch} />;
    case "rotate":
      return (
        <button type="button" disabled={board.pages.length === 0} onClick={() => dispatch({ type: "allRotated" })}>
          <Icon name="rotate" size={18} />
          {t.board.rotateAll}
        </button>
      );
    case "extract-pages":
      return <p class="chosen">{t.flow.chosen(board.selected.length)}</p>;
    case "pdf-to-jpg":
      return <JpgOptions t={t} pages={board.pages.length} settings={settings} onSettings={onSettings} />;
    case "compress":
      return <CompressOptions t={t} settings={settings} onSettings={onSettings} />;
    case "protect":
      return <ProtectOptions t={t} settings={settings} onSettings={onSettings} />;
    case "page-numbers":
      return <PageNumberOptions t={t} board={board} settings={settings} onSettings={onSettings} />;
    case "watermark":
      return <WatermarkOptions t={t} board={board} settings={settings} onSettings={onSettings} />;
    case "overlay":
      return (
        <>
          <div class="layer-choice">
            <label class="button">
              {settings.layer ? t.overlay.change : t.overlay.choose}
              <input class="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => {
                const [file] = event.currentTarget.files ?? [];
                if (file) onLayer(file);
                event.currentTarget.value = "";
              }} />
            </label>
            {settings.layer && <p class="layer-name"><span class="file-name">{settings.layer.name}</span> · {t.overlay.pages(settings.layer.pages)}</p>}
            {layerError && <p class="error" role="alert">{layerError}</p>}
          </div>
          <fieldset class="choices">
            <legend>{t.overlay.legend}</legend>
            {([false, true] as const).map((under) => (
              <Choice key={String(under)} name="layer-position" checked={settings.layerUnder === under} onPick={() => onSettings({ layerUnder: under })}
                title={t.overlay[under ? "under" : "over"].name} note={t.overlay[under ? "under" : "over"].note} />
            ))}
          </fieldset>
        </>
      );
    case "pixelize":
      return (
        <fieldset class="choices">
          <legend>{t.pixelize.legend}</legend>
          {([150, 300] as const).map((ppi) => (
            <Choice key={ppi} name="pixel-ppi" checked={settings.pixelPpi === ppi} onPick={() => onSettings({ pixelPpi: ppi })} title={t.pixelize[ppi].name} note={t.pixelize[ppi].note} />
          ))}
        </fieldset>
      );
    case "split-in-half":
      return (
        <fieldset class="choices">
          <legend>{t.halves.legend}</legend>
          {(["vertical", "horizontal"] as const).map((cut) => (
            <Choice key={cut} name="half-cut" checked={settings.halfCut === cut} onPick={() => onSettings({ halfCut: cut })} title={t.halves[cut].name} note={t.halves[cut].note} />
          ))}
        </fieldset>
      );
    case "pages-per-sheet":
      return (
        <fieldset class="choices">
          <legend>{t.perSheet.legend}</legend>
          {([2, 4, 6, 9, 16] as const).map((count) => (
            <Choice key={count} name="per-sheet" checked={settings.perSheet === count} onPick={() => onSettings({ perSheet: count })} title={t.perSheet.title(count)} note={t.perSheet.note(count)} />
          ))}
        </fieldset>
      );
    default:
      return null;
  }
}

type ChoiceProps = {
  name: string;
  checked: boolean;
  onPick: () => void;
  title: string;
  note: string;
  picture?: ComponentChildren;
  badge?: string | undefined;
  help?: ComponentChildren;
};

/** A radio button drawn as a card: the whole card is its label. The input comes first: a label picks its first control, and the « ? » button is one. */
function Choice({ name, checked, onPick, title, note, picture, badge, help }: ChoiceProps) {
  return (
    <label class="choice">
      <input type="radio" name={name} checked={checked} onChange={onPick} />
      {picture}
      <span class="choice-text">
        <span class="choice-title">
          {title}
          {badge && <span class="badge">{badge}</span>}
          {help}
        </span>
        <span class="choice-note">{note}</span>
      </span>
    </label>
  );
}

/** A « ? » that opens its explanation under it. Escape, or leaving the button, closes it. */
function Help({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span class="help">
      <button
        type="button"
        class="help-button"
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          // Inside a choice's label: the click opens the help, it does not pick the choice.
          event.preventDefault();
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        onBlur={() => setOpen(false)}
      >
        <Icon name="help" size={20} />
      </button>
      {open && <span class="tip">{text}</span>}
    </span>
  );
}

function JpgOptions({ t, pages, settings, onSettings }: { t: Dictionary; pages: number; settings: Settings; onSettings: (change: Partial<Settings>) => void }) {
  return (
    <>
      <fieldset class="choices">
        <legend>{t.toJpg.what}</legend>
        <div class="tiles">
          <Choice
            name="mode"
            checked={settings.mode === "pages"}
            onPick={() => onSettings({ mode: "pages" })}
            title={t.toJpg.pages.name}
            note={t.toJpg.pages.note}
            picture={<ModePicture extract={false} />}
          />
          <Choice
            name="mode"
            checked={settings.mode === "extract"}
            onPick={() => onSettings({ mode: "extract" })}
            title={t.toJpg.extract.name}
            note={t.toJpg.extract.note}
            picture={<ModePicture extract />}
            help={<Help label={t.toJpg.extract.helpLabel} text={t.toJpg.extract.help} />}
          />
        </div>
        {settings.mode === "pages" && pages > 0 && <p class="hint">{t.toJpg.count(pages)}</p>}
      </fieldset>
      <fieldset class="choices">
        <legend>{t.toJpg.quality}</legend>
        <div class="switch">
          <Choice name="quality" checked={settings.quality === "normal"} onPick={() => onSettings({ quality: "normal" })} title={t.toJpg.normal.name} note={t.toJpg.normal.note} />
          <Choice name="quality" checked={settings.quality === "high"} onPick={() => onSettings({ quality: "high" })} title={t.toJpg.high.name} note={t.toJpg.high.note} />
        </div>
        <p class="hint">
          <Icon name="help" size={16} />
          {t.toJpg.qualityHint}
        </p>
      </fieldset>
    </>
  );
}

const levels = ["extreme", "recommended", "low"] as const;

function CompressOptions({ t, settings, onSettings }: { t: Dictionary; settings: Settings; onSettings: (change: Partial<Settings>) => void }) {
  return (
    <fieldset class="choices">
      <legend>{t.compress.legend}</legend>
      {levels.map((level, index) => (
        <Choice
          key={level}
          name="level"
          checked={settings.level === level}
          onPick={() => onSettings({ level })}
          title={t.compress.levels[level].name}
          note={t.compress.levels[level].note}
          badge={level === "recommended" ? t.compress.advised : undefined}
          picture={<Strength bars={levels.length - index} />}
        />
      ))}
      <p class="hint sure">
        <Icon name="check" size={16} />
        {t.compress.textStays}
      </p>
    </fieldset>
  );
}

/** Three bars, as many filled as the level squeezes. */
function Strength({ bars }: { bars: number }) {
  return (
    <span class="strength" aria-hidden="true">
      {[10, 16, 22].map((height, index) => (
        <span key={height} class={index < bars ? "on" : undefined} style={`height: ${height}px`} />
      ))}
    </span>
  );
}

function ModePicture({ extract }: { extract: boolean }) {
  return (
    <svg class="mode-picture" viewBox="0 0 72 46" width="72" height="46" fill="none" stroke="var(--monk-ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M6 4 H24 L30 10 V42 H6 Z" fill="var(--paper)" />
      {extract ? (
        <>
          <path d="M11 14 H25 M11 36 H25" stroke="var(--sheet-line)" />
          <rect x="11" y="19" width="14" height="12" rx="1.5" stroke="var(--sheet-line)" stroke-width="2" stroke-dasharray="3 2" />
          <rect x="44" y="13" width="24" height="21" rx="3" fill="var(--convert-tint)" />
          <path d="M47 31 L53 24 L57 28 L60 26 L65 31" stroke="var(--convert)" />
          <circle cx="60" cy="19" r="2.2" fill="var(--convert)" stroke="none" />
        </>
      ) : (
        <>
          <path d="M11 16 H25 M11 22 H25 M11 28 H21" stroke="var(--sheet-line)" />
          <rect x="44" y="5" width="24" height="36" rx="3" fill="var(--convert-tint)" />
          <path d="M48 12 H62 M48 17 H64" stroke="var(--convert)" />
          <path d="M47 36 L53 28 L57 32 L60 30 L65 36" stroke="var(--convert)" />
        </>
      )}
      <path d="M33 23 H40 M36.5 19.5 L40 23 L36.5 26.5" stroke="var(--convert)" />
    </svg>
  );
}

function CutEvery({ t, dispatch }: { t: Dictionary; dispatch: (action: Action) => void }) {
  const [every, setEvery] = useState(1);
  return (
    <form
      class="cut-every"
      onSubmit={(event) => {
        event.preventDefault();
        dispatch({ type: "cutEvery", pageCount: every });
      }}
    >
      <label>
        {t.board.cutEvery}{" "}
        <input type="number" min={1} value={every} onInput={(event) => setEvery(Math.max(1, Number(event.currentTarget.value) || 1))} />{" "}
        {t.board.cutEveryUnit}
      </label>
      <button type="submit">{t.board.apply}</button>
    </form>
  );
}

function ProtectOptions({ t, settings, onSettings }: { t: Dictionary; settings: Settings; onSettings: (change: Partial<Settings>) => void }) {
  const mismatch = settings.confirm !== "" && settings.confirm !== settings.password;
  return (
    <fieldset class="secret">
      <legend>{t.protect.legend}</legend>
      <label>
        {t.protect.password}
        <input type="password" autocomplete="new-password" value={settings.password} onInput={(event) => onSettings({ password: event.currentTarget.value })} />
      </label>
      <label>
        {t.protect.confirm}
        <input type="password" autocomplete="new-password" value={settings.confirm} onInput={(event) => onSettings({ confirm: event.currentTarget.value })} />
      </label>
      {mismatch && <p class="error" role="alert">{t.protect.mismatch}</p>}
      <p class="hint">{t.protect.note}</p>
    </fieldset>
  );
}

const formats: NumberFormat[] = ["number", "of", "page"];
const positions: NumberPosition[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];
const whole = (value: string, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(value)) || min));

function PageNumberOptions({ t, board, settings, onSettings }: { t: Dictionary; board: Board; settings: Settings; onSettings: (change: Partial<Settings>) => void }) {
  const ready = board.docs.find((doc) => doc.status.kind === "ready")?.status;
  const pages = ready?.kind === "ready" ? ready.pageCount : lastPage;
  const n = t.pageNumbers;
  return (
    <>
      <fieldset class="choices">
        <legend>{n.format}</legend>
        {formats.map((format) => (
          <Choice key={format} name="number-format" checked={settings.numberFormat === format} onPick={() => onSettings({ numberFormat: format })} title={n.formats[format].name} note={n.formats[format].note} />
        ))}
      </fieldset>
      <fieldset class="positions">
        <legend>{n.position}</legend>
        {positions.map((position) => (
          <label key={position} title={n.positions[position]}>
            <input type="radio" name="number-position" checked={settings.numberPosition === position} onChange={() => onSettings({ numberPosition: position })} />
            <span class="visually-hidden">{n.positions[position]}</span>
          </label>
        ))}
      </fieldset>
      <div class="number-fields">
        <label>
          {n.first}
          <input type="number" min={0} max={9999} value={settings.firstNumber} onInput={(event) => onSettings({ firstNumber: whole(event.currentTarget.value, 0, 9999) })} />
        </label>
        <label>
          {n.size}
          <input type="number" min={6} max={36} value={settings.numberSize} onInput={(event) => onSettings({ numberSize: whole(event.currentTarget.value, 6, 36) })} />
        </label>
      </div>
      <PageRange t={t} pages={pages} known={ready?.kind === "ready"} settings={settings} onSettings={onSettings} />
    </>
  );
}

type OptionProps = { t: Dictionary; settings: Settings; onSettings: (change: Partial<Settings>) => void };

function PageRange({ t, pages, known, settings, onSettings }: OptionProps & { pages: number; known: boolean }) {
  const n = t.pageNumbers;
  return (
    <fieldset class="choices">
      <legend>{n.pages}</legend>
      <Choice name="page-range" checked={settings.allPages} onPick={() => onSettings({ allPages: true })} title={n.all} note={known ? n.allNote(pages) : ""} />
      <Choice name="page-range" checked={!settings.allPages} onPick={() => onSettings({ allPages: false, fromPage: 1, toPage: lastPage })} title={n.range} note={n.rangeNote} />
      {!settings.allPages && (
        <div class="number-fields">
          <label>
            {n.from}
            <input type="number" min={1} max={pages} value={settings.fromPage} onInput={(event) => onSettings({ fromPage: whole(event.currentTarget.value, 1, pages), toPage: Math.max(settings.toPage, whole(event.currentTarget.value, 1, pages)) })} />
          </label>
          <label>
            {n.to}
            <input type="number" min={settings.fromPage} max={pages} value={Math.min(settings.toPage, pages)} onInput={(event) => onSettings({ toPage: whole(event.currentTarget.value, settings.fromPage, pages) })} />
          </label>
        </div>
      )}
    </fieldset>
  );
}

function WatermarkOptions({ t, board, settings, onSettings }: OptionProps & { board: Board }) {
  const ready = board.docs.find((doc) => doc.status.kind === "ready")?.status;
  const pages = ready?.kind === "ready" ? ready.pageCount : lastPage;
  const w = t.watermark;
  const slider = (label: string, value: number, min: number, max: number, unit: string, change: (value: number) => Partial<Settings>) => (
    <label class="slider">
      <span>{label} <output>{value}{unit}</output></span>
      <input type="range" min={min} max={max} value={value} onInput={(event) => onSettings(change(Number(event.currentTarget.value)))} />
    </label>
  );
  return (
    <>
      <label class="mark-text">
        {w.text}
        <input type="text" maxLength={80} placeholder={w.defaultText} value={settings.markText} onInput={(event) => onSettings({ markText: event.currentTarget.value })} />
      </label>
      {!writable(settings.markText) && <p class="error" role="alert">{w.unwritable}</p>}
      <fieldset class="swatches">
        <legend>{w.color}</legend>
        {(Object.keys(markColors) as MarkColor[]).map((color) => (
          <label key={color} title={w.colors[color]} style={{ "--swatch": `rgb(${markColors[color].join(" ")})` }}>
            <input type="radio" name="mark-color" checked={settings.markColor === color} onChange={() => onSettings({ markColor: color })} />
            <span class="visually-hidden">{w.colors[color]}</span>
          </label>
        ))}
      </fieldset>
      {slider(w.opacity, settings.markOpacity, 10, 100, " %", (value) => ({ markOpacity: value }))}
      {slider(w.angle, settings.markAngle, -90, 90, "°", (value) => ({ markAngle: value }))}
      {slider(w.width, settings.markWidth, 20, 100, " %", (value) => ({ markWidth: value }))}
      <PageRange t={t} pages={pages} known={ready?.kind === "ready"} settings={settings} onSettings={onSettings} />
    </>
  );
}

