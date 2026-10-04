// AGPL-3.0-or-later with the additional terms in /LICENSE-EXCEPTION.md: the monk is a trademark of Holy PDF's publisher.
export type SceneKind = "merge" | "split" | "organize" | "delete" | "extract" | "rotate" | "images" | "pdf-to-jpg" | "compress" | "sign" | "scan" | "protect" | "unlock" | "page-numbers" | "watermark" | "flatten" | "pages-per-sheet" | "split-in-half" | "pixelize" | "redact" | "ocr" | "pdf-to-word" | "overlay" | "bookmarks" | "repair" | "edit" | "crop";

type Props = { kind: SceneKind; size: number };

const accent = "var(--scene-accent)";
const lines = "var(--sheet-line)";

/** Drawn in a 120 × 120 box. The parent sets `--scene-accent` to the tool's category color. */
export function Scene({ kind, size }: Props) {
  return (
    <svg
      class="scene"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      stroke="var(--monk-ink)"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <SceneDrawing kind={kind} />
    </svg>
  );
}

function SceneDrawing({ kind }: { kind: SceneKind }) {
  switch (kind) {
    case "crop":
      return (
        <g class="scene-crop">
          <path d="M24 16 H82 L96 30 V108 H24 Z" fill="var(--paper)" />
          <path d="M40 44 H74 M40 54 H68 M40 64 H72 M40 74 H60" stroke={lines} />
          <rect x="33" y="35" width="50" height="50" fill="none" stroke={accent} stroke-width="3" stroke-dasharray="6 4" />
          <path d="M33 26 V35 H24 M83 94 V85 H92" stroke={accent} stroke-width="4" fill="none" />
        </g>
      );
    case "edit":
      return (
        <g class="scene-edit">
          <path d="M22 16 H80 L94 30 V108 H22 Z" fill="var(--paper)" />
          <rect x="31" y="56" width="46" height="12" rx="2" fill="var(--highlight-soft)" />
          <path d="M34 40 H72 M34 48 H64 M34 62 H70 M34 78 H68 M34 88 H56" stroke={lines} />
          <path d="M66 104 L98 72 L106 80 L74 112 L64 114 Z" fill={accent} />
          <path d="M92 78 L100 86" stroke="var(--paper)" stroke-width="2" />
        </g>
      );
    case "repair":
      return (
        <g class="scene-repair">
          <path d="M24 16 H82 L96 30 V108 H24 Z" fill="var(--paper)" />
          <path d="M36 38 H76 M36 48 H70 M36 86 H74 M36 96 H62" stroke={lines} />
          <path d="M24 66 L38 59 L50 71 L62 59 L74 71 L86 59 L96 66" stroke={accent} stroke-width="3" fill="none" />
          <path d="M38 52 V66 M50 64 V78 M62 52 V66 M74 64 V78 M86 52 V66" stroke={accent} stroke-width="2.5" />
        </g>
      );
    case "bookmarks":
      return (
        <g class="scene-bookmarks">
          <path d="M22 18 H92 V108 H22 Z" fill="var(--paper)" />
          <path d="M34 40 H62 M34 50 H74 M34 70 H58 M34 80 H72 M34 90 H66" stroke={lines} />
          <path d="M70 10 H86 V50 L78 43 L70 50 Z" fill={accent} />
          <path d="M14 36 H24 M14 66 H24" stroke={accent} stroke-width="4" />
        </g>
      );
    case "overlay":
      return (
        <g class="scene-overlay">
          <path d="M18 30 H62 L76 44 V106 H18 Z" fill="var(--paper)" />
          <path d="M28 56 H64 M28 66 H60 M28 76 H66 M28 86 H52" stroke={lines} />
          <path d="M44 14 H88 L102 28 V90 H44 Z" fill="var(--highlight-soft)" stroke={accent} stroke-dasharray="5 4" />
          <path d="M56 26 H90 M56 34 H78" stroke={accent} stroke-width="3" />
        </g>
      );
    case "pdf-to-word":
      return (
        <g class="scene-pdf-to-word">
          <path d="M8 24 H42 L52 34 V96 H8 Z" fill="var(--paper)" />
          <path d="M42 24 V34 H52" />
          <path d="M16 46 H44 M16 54 H46 M16 62 H38 M16 70 H42" stroke={lines} />
          <path d="M58 60 H70 M65 55 L71 60 L65 65" stroke={accent} stroke-width="3" />
          <path d="M76 24 H112 V96 H76 Z" fill="var(--paper)" />
          <path d="M83 40 L87 56 L91 46 L95 56 L99 40" stroke={accent} stroke-width="3" />
          <path d="M83 66 H105 M83 74 H101 M83 82 H105" stroke={lines} />
        </g>
      );
    case "ocr":
      return (
        <g class="scene-ocr">
          <path d="M18 14 H62 L76 28 V106 H18 Z" fill="var(--paper)" />
          <path d="M62 14 V28 H76" />
          <path d="M28 40 H64 M28 50 H58 M28 84 H60 M28 94 H50" stroke={lines} />
          <circle cx="72" cy="64" r="17" fill="var(--highlight-soft)" stroke={accent} stroke-width="3" />
          <path d="M64 60 H80 M64 68 H76" />
          <path d="M84 77 L100 93" stroke={accent} stroke-width="5" />
        </g>
      );
    case "redact":
      return (
        <g class="scene-redact">
          <path d="M22 14 H66 L80 28 V106 H22 Z" fill="var(--paper)" />
          <path d="M66 14 V28 H80" />
          <path d="M32 40 H68 M32 70 H64 M32 94 H56" stroke={lines} />
          <path d="M30 48 H72 V60 H30 Z M30 78 H62 V88 H30 Z" fill="var(--monk-ink)" stroke="none" />
          <path d="M98 30 C98 30 88 46 88 54 A10 10 0 0 0 108 54 C108 46 98 30 98 30 Z" fill={accent} />
        </g>
      );
    case "pixelize":
      return (
        <g class="scene-pixelize">
          <path d="M8 24 H42 L52 34 V96 H8 Z" fill="var(--paper)" />
          <path d="M42 24 V34 H52" />
          <path d="M16 46 H44 M16 54 H46 M16 62 H38" stroke={lines} />
          <path d="M58 60 H70 M65 55 L71 60 L65 65" stroke={accent} stroke-width="3" />
          <path d="M76 24 H112 V96 H76 Z" fill="var(--paper)" />
          <path d="M82 44 H88 V50 H82 Z M94 44 H100 V50 H94 Z M88 50 H94 V56 H88 Z M82 56 H88 V62 H82 Z M100 56 H106 V62 H100 Z M88 62 H94 V68 H88 Z" fill={accent} stroke="none" />
        </g>
      );
    case "split-in-half":
      return (
        <g class="scene-split-in-half">
          <path d="M10 26 H110 V96 H10 Z" fill="var(--paper)" />
          <path d="M18 40 H50 M18 48 H52 M18 56 H44 M70 40 H102 M70 48 H100 M70 56 H94" stroke={lines} />
          <path d="M60 18 V104" stroke={accent} stroke-width="3" stroke-dasharray="6 5" />
        </g>
      );
    case "pages-per-sheet":
      return (
        <g class="scene-pages-per-sheet">
          <path d="M20 14 H100 V106 H20 Z" fill="var(--paper)" />
          <path d="M60 14 V106 M20 60 H100" stroke={lines} />
          <rect x="28" y="22" width="24" height="30" rx="2" fill={accent} stroke="none" opacity="0.7" />
          <rect x="68" y="22" width="24" height="30" rx="2" fill={accent} stroke="none" opacity="0.5" />
          <rect x="28" y="68" width="24" height="30" rx="2" fill={accent} stroke="none" opacity="0.5" />
          <rect x="68" y="68" width="24" height="30" rx="2" fill={accent} stroke="none" opacity="0.3" />
        </g>
      );
    case "flatten":
      return (
        <g class="scene-flatten">
          <path d="M18 30 H74 L88 44 V104 H18 Z" fill="var(--paper)" />
          <path d="M74 30 V44 H88" />
          <path d="M28 54 H70 M28 62 H76 M28 88 H60" stroke={lines} />
          <rect x="26" y="70" width="40" height="11" rx="2" fill={accent} stroke="none" opacity="0.5" />
          <rect x="44" y="12" width="56" height="12" rx="6" fill={accent} stroke="none" />
          <path d="M36 18 H44 M100 18 H108" stroke-width="4" />
        </g>
      );
    case "watermark":
      return (
        <g class="scene-watermark">
          <path d="M22 14 H78 L92 28 V106 H22 Z" fill="var(--paper)" />
          <path d="M78 14 V28 H92" />
          <path d="M32 36 H72 M32 44 H80 M32 92 H66" stroke={lines} />
          <path d="M30 84 L84 50" stroke={accent} stroke-width="9" opacity="0.45" />
        </g>
      );
    case "page-numbers":
      return (
        <g class="scene-page-numbers">
          <path d="M14 18 H50 L60 28 V96 H14 Z" fill="var(--paper)" />
          <path d="M50 18 V28 H60" />
          <path d="M22 40 H50 M22 48 H52 M22 56 H44" stroke={lines} />
          <rect x="29" y="78" width="16" height="12" rx="3" fill={accent} stroke="none" />
          <path d="M66 26 H102 L112 36 V104 H66 Z" fill="var(--paper)" />
          <path d="M102 26 V36 H112" />
          <path d="M74 48 H102 M74 56 H104 M74 64 H96" stroke={lines} />
          <rect x="81" y="86" width="16" height="12" rx="3" fill={accent} stroke="none" />
        </g>
      );
    case "protect":
    case "unlock":
      return (
        <g class={`scene-${kind}`}>
          <path d="M12 24 H48 L58 34 V98 H12 Z" fill="var(--paper)" />
          <path d="M48 24 V34 H58" />
          <path d="M20 46 H48 M20 54 H50 M20 62 H42 M20 70 H46" stroke={lines} />
          <path d={kind === "protect" ? "M80 58 V46 a12 12 0 0 1 24 0 V58" : "M80 58 V40 a12 12 0 0 1 24 0 V44"} stroke={accent} stroke-width="4" />
          <rect x="72" y="58" width="40" height="32" rx="5" fill={accent} stroke="none" />
          <circle cx="92" cy="72" r="4" fill="var(--paper)" stroke="none" />
          <path d="M92 75 V81" stroke="var(--paper)" stroke-width="3" />
        </g>
      );
    case "sign":
      return (
        <g class="scene-sign">
          <path d="M20 14 H64 L78 28 V106 H20 Z" fill="var(--paper)" />
          <path d="M64 14 V28 H78" />
          <path d="M30 40 H66 M30 49 H62 M30 58 H54" stroke={lines} />
          <path d="M29 84 C38 62 47 67 39 81 S50 91 55 79 S59 87 67 80" stroke={accent} stroke-width="3" />
          <path d="M29 94 H66" stroke={lines} />
          <path d="M66 69 C64 47 82 18 108 10 C108 37 94 59 66 69 Z" fill="var(--highlight-soft)" stroke={accent} />
          <path d="M61 79 L98 23 M75 59 L75 44 M82 49 L95 45" stroke={accent} />
        </g>
      );
    case "merge":
      return (
        <g class="scene-merge">
          <path d="M22 14 H60 L72 26 V80 H22 Z" fill="var(--paper)" />
          <path d="M60 14 V26 H72" />
          <path d="M40 34 H78 L90 46 V100 H40 Z" fill="var(--paper)" />
          <path d="M78 34 V46 H90" />
          <path d="M48 58 H80 M48 66 H82 M48 74 H72 M48 82 H80" stroke={lines} />
          <path d="M44 44 L58 39" stroke-width="4" />
          <path d="M100 18 v12 M94 24 h12" stroke={accent} stroke-width="3" />
        </g>
      );
    case "split":
      return (
        <g class="scene-split">
          <path d="M30 10 H68 L80 22 V50 H30 Z" fill="var(--paper)" />
          <path d="M68 10 V22 H80" />
          <path d="M38 30 H70 M38 38 H72" stroke={lines} />
          <g transform="rotate(7 60 88)">
            <path d="M34 68 H84 V108 H34 Z" fill="var(--paper)" />
            <path d="M42 80 H74 M42 88 H76 M42 96 H64" stroke={lines} />
          </g>
          <path d="M12 59 H108" stroke={accent} stroke-dasharray="5 6" stroke-width="3" />
        </g>
      );
    case "organize":
      return (
        <g class="scene-organize">
          <path d="M10 56 H30 L36 62 V92 H10 Z" fill="var(--paper)" />
          <path d="M47 56 H67 L73 62 V92 H47 Z" fill="var(--paper)" />
          <path d="M84 56 H104 L110 62 V92 H84 Z" fill="var(--highlight-soft)" stroke={accent} />
          <text x="23" y="81" font-family="sans-serif" font-size="17" font-weight="800" text-anchor="middle" fill="var(--monk-ink)" stroke="none">1</text>
          <text x="60" y="81" font-family="sans-serif" font-size="17" font-weight="800" text-anchor="middle" fill="var(--monk-ink)" stroke="none">2</text>
          <text x="97" y="81" font-family="sans-serif" font-size="17" font-weight="800" text-anchor="middle" fill={accent} stroke="none">3</text>
          <path d="M97 48 C92 16 30 14 23 44" stroke={accent} stroke-width="3" />
          <path d="M16 38 L23 47 L31 40" stroke={accent} stroke-width="3" />
        </g>
      );
    case "delete":
      return (
        <g class="scene-delete">
          <path d="M30 14 H70 L84 28 V98 H30 Z" fill="var(--paper)" />
          <path d="M70 14 V28 H84" />
          <path d="M42 44 L72 74 M72 44 L42 74" stroke={accent} stroke-width="6" />
          <circle cx="96" cy="30" r="3" fill={accent} stroke="none" />
          <circle cx="104" cy="44" r="2.5" fill={accent} stroke="none" />
          <circle cx="20" cy="92" r="3" fill={accent} stroke="none" />
        </g>
      );
    case "extract":
      return (
        <g class="scene-extract">
          <path d="M14 42 H50 L60 52 V108 H14 Z" fill="var(--paper)" />
          <path d="M22 36 H58 L68 46 V102 H22 Z" fill="var(--paper)" />
          <path d="M62 10 H92 L104 22 V76 H62 Z" fill="var(--highlight-soft)" stroke={accent} />
          <path d="M92 10 V22 H104" stroke={accent} />
          <path d="M70 34 H94 M70 42 H96 M70 50 H86" stroke={accent} />
          <path d="M40 70 C48 84 70 92 90 88" stroke={accent} stroke-width="3" />
          <path d="M84 81 L91 88 L83 94" stroke={accent} stroke-width="3" />
        </g>
      );
    case "rotate":
      return (
        <g class="scene-rotate">
          <g transform="rotate(90 60 64)">
            <path d="M36 34 H72 L84 46 V96 H36 Z" fill="var(--paper)" />
            <path d="M72 34 V46 H84" />
            <path d="M44 58 H74 M44 66 H76 M44 74 H66" stroke={lines} />
          </g>
          <path d="M58 12 A50 50 0 0 1 108 50" stroke={accent} stroke-width="4" />
          <path d="M100 44 L108 53 L115 43" stroke={accent} stroke-width="4" />
        </g>
      );
    case "images":
      return (
        <g class="scene-images">
          <rect x="6" y="30" width="50" height="42" rx="4" fill="var(--paper)" />
          <path d="M10 66 L24 48 L34 60 L41 52 L52 66 Z" fill={accent} stroke="none" />
          <circle cx="44" cy="41" r="5" fill="var(--rope)" stroke="none" />
          <path d="M62 52 H76 M71 47 L77 52 L71 57" stroke={accent} stroke-width="3" />
          <path d="M82 22 H104 L114 32 V92 H82 Z" fill="var(--paper)" />
          <path d="M104 22 V32 H114" />
          <rect x="87" y="40" width="22" height="16" rx="2" fill="var(--highlight-soft)" stroke={accent} stroke-width="2" />
          <path d="M88 66 H108 M88 74 H104" stroke={lines} />
        </g>
      );
    case "pdf-to-jpg":
      return (
        <g class="scene-pdf-to-jpg">
          <path d="M8 24 H38 L48 34 V96 H8 Z" fill="var(--paper)" />
          <path d="M38 24 V34 H48" />
          <path d="M16 46 H40 M16 54 H40 M16 62 H32" stroke={lines} />
          <path d="M54 60 H66 M61 55 L67 60 L61 65" stroke={accent} stroke-width="3" />
          <rect x="72" y="22" width="40" height="32" rx="3" fill="var(--paper)" />
          <path d="M76 50 L87 37 L95 46 L100 41 L108 50 Z" fill={accent} stroke="none" />
          <circle cx="101" cy="31" r="3.5" fill="var(--rope)" stroke="none" />
          <rect x="72" y="64" width="40" height="32" rx="3" fill="var(--paper)" />
          <path d="M76 92 L87 79 L95 88 L100 83 L108 92 Z" fill={accent} stroke="none" />
          <circle cx="101" cy="73" r="3.5" fill="var(--rope)" stroke="none" />
        </g>
      );
    case "compress":
      return (
        <g class="scene-compress">
          <path d="M8 38 H40 L50 48 V102 H8 Z" fill="var(--paper)" />
          <path d="M13 32 H45 L55 42 V96 H13 Z" fill="var(--paper)" />
          <path d="M18 26 H50 L60 36 V90 H18 Z" fill="var(--paper)" />
          <path d="M50 26 V36 H60" />
          <path d="M26 48 H50 M26 56 H52 M26 64 H46" stroke={lines} />
          <path d="M66 62 H80 M74 55 L81 62 L74 69" stroke={accent} stroke-width="3.5" />
          <path d="M88 44 H106 L114 52 V92 H88 Z" fill="var(--paper)" />
          <path d="M106 44 V52 H114" />
          <path d="M93 62 H108 M93 70 H110 M93 78 H104" stroke={lines} />
        </g>
      );
    case "scan":
      return (
        <g class="scene-scan">
          <rect x="8" y="22" width="50" height="66" rx="4" fill={lines} stroke="none" />
          <path d="M16 34 L48 30 L52 76 L18 80 Z" fill="var(--paper)" />
          <path d="M22 44 H44 M22 52 H46 M23 60 H40" stroke={lines} transform="rotate(-6 34 52)" />
          <circle cx="16" cy="34" r="3.5" fill={accent} stroke="none" />
          <circle cx="48" cy="30" r="3.5" fill={accent} stroke="none" />
          <circle cx="52" cy="76" r="3.5" fill={accent} stroke="none" />
          <circle cx="18" cy="80" r="3.5" fill={accent} stroke="none" />
          <path d="M62 56 H74 M69 51 L75 56 L69 61" stroke={accent} stroke-width="3" />
          <path d="M80 24 H102 L112 34 V92 H80 Z" fill="var(--paper)" />
          <path d="M102 24 V34 H112" />
          <path d="M86 46 H106 M86 54 H106 M86 62 H100 M86 70 H104" stroke={lines} />
        </g>
      );
  }
}
