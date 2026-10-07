import { useEffect, useRef, useState } from "preact/hooks";
import type { SignatureImage } from "../engine/types";
import type { Lang } from "../tools";
import { loadSignatureTextFont, maxSignatureTextLength, normalizedSignatureText, renderSignatureText, type SignatureTextStyle } from "./typedText";
import "./typed-signature.css";

const copy = {
  en: { label: "Your text", placeholder: "Your name, initials, or Read and approved", style: "Writing style", handwritten: "Handwritten", simple: "Simple", preview: "Text preview", empty: "Your text will appear here", use: "Add to this page", loading: "Loading writing style…", failed: "The writing style could not load. Please try again.", renderFailed: "This text could not be prepared. Please try again.", retry: "Try again", hint: "Up to 120 characters. The background stays transparent." },
  fr: { label: "Votre texte", placeholder: "Votre nom, vos initiales ou Lu et approuvé", style: "Style d’écriture", handwritten: "Manuscrit", simple: "Simple", preview: "Aperçu du texte", empty: "Votre texte apparaîtra ici", use: "Ajouter sur cette page", loading: "Chargement du style d’écriture…", failed: "Le style d’écriture n’a pas pu être chargé. Réessayez.", renderFailed: "Ce texte n’a pas pu être préparé. Réessayez.", retry: "Réessayer", hint: "120 caractères maximum. Le fond reste transparent." },
  "pt-br": { label: "Seu texto", placeholder: "Seu nome, suas iniciais ou De acordo", style: "Estilo de escrita", handwritten: "Manuscrito", simple: "Simples", preview: "Visualização do texto", empty: "Seu texto aparecerá aqui", use: "Adicionar a esta página", loading: "Carregando o estilo de escrita…", failed: "O estilo de escrita não pôde ser carregado. Tente novamente.", renderFailed: "Este texto não pôde ser preparado. Tente novamente.", retry: "Tentar novamente", hint: "Até 120 caracteres. O fundo continua transparente." },
};
type Props = { lang: Lang; disabled: boolean; onReady?: (image: SignatureImage | null) => void };

export function TypedSignature({ lang, disabled, onReady }: Props) {
  const t = copy[lang];
  const [text, setText] = useState("");
  const [style, setStyle] = useState<SignatureTextStyle>("handwritten");
  const [attempt, setAttempt] = useState(0);
  const [font, setFont] = useState<SignatureTextStyle | null>(null);
  const [error, setError] = useState<"font" | "render" | null>(null);
  const [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<SignatureImage | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  function invalidate() { image.current = null; setReady(false); onReadyRef.current?.(null); }
  useEffect(() => {
    let current = true;
    setFont(null); invalidate(); setError(null);
    loadSignatureTextFont(style).then(() => { if (current) setFont(style); })
      .catch(() => { if (current) setError("font"); });
    return () => { current = false; };
  }, [style, attempt]);
  useEffect(() => {
    invalidate();
    if (!canvas.current || font !== style || !normalizedSignatureText(text)) return;
    try {
      image.current = renderSignatureText(canvas.current, text, style);
      setReady(true); setError(null);
    } catch { setError("render"); }
    onReadyRef.current?.(image.current);
  }, [text, style, font]);
  useEffect(() => {
    const surface = canvas.current;
    return () => { image.current = null; if (surface) { surface.width = 0; surface.height = 0; } };
  }, []);
  const loading = font !== style && !error;
  return <div class="signature-typed">
    <label>{t.label}<input type="text" value={text} maxLength={maxSignatureTextLength} placeholder={t.placeholder} disabled={disabled} autoComplete="off" spellcheck={false} aria-describedby="signature-text-hint" onInput={(event) => { invalidate(); setText(event.currentTarget.value); }} /></label>
    <fieldset disabled={disabled}>
      <legend>{t.style}</legend>
      <div class="signature-text-styles">{(["handwritten", "simple"] as const).map((value) => <button key={value} type="button" aria-pressed={style === value} onClick={() => { if (style !== value) { invalidate(); setStyle(value); } }}>{t[value]}</button>)}</div>
    </fieldset>
    <div class="signature-text-preview" aria-busy={loading}>
      <canvas ref={canvas} width="1" height="1" role="img" aria-label={t.preview} hidden={!ready} />
      {!ready && !error && <span role="status">{loading ? t.loading : t.empty}</span>}
      {error && <div class="signature-text-failure"><p role="alert">{error === "font" ? t.failed : t.renderFailed}</p><button type="button" disabled={disabled} onClick={() => { invalidate(); setAttempt((value) => value + 1); }}>{t.retry}</button></div>}
    </div>
    <p id="signature-text-hint" class="signature-hint">{t.hint}</p>
  </div>;
}
