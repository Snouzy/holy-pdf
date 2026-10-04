// AGPL-3.0-or-later with the additional terms in /LICENSE-EXCEPTION.md: the monk is a trademark of Holy PDF's publisher.
export type Accessory = "stapler" | "scissors" | "sheet" | "eraser" | "loupe" | "arrows" | "frame" | "quill" | "stamp" | "lock" | "book" | "phone" | "none";
export type Mood = "happy" | "focus" | "joy" | "oops" | "sleep";

type Props = { size: number; accessory?: Accessory; mood?: Mood; layer?: "all" | "prop"; halo?: boolean };

const ink = "var(--monk-ink)";
const stroke = 5;
const thin = 3;

/** Drawn in a 200 × 220 box. `layer="prop"` draws the accessory and the right hand only, to go over a clipped monk. */
export function Monk({ size, accessory = "none", mood = "happy", layer = "all", halo = false }: Props) {
  return (
    <svg class="monk" viewBox="0 0 200 220" width={size} height={Math.round(size * 1.1)} aria-hidden="true">
      {layer === "all" && <Body mood={mood} halo={halo} />}
      {layer === "all" && <circle cx="74" cy="166" r="11" fill="var(--skin)" stroke={ink} stroke-width={thin} />}
      <circle cx="126" cy="166" r="11" fill="var(--skin)" stroke={ink} stroke-width={thin} />
      <AccessoryDrawing accessory={accessory} />
    </svg>
  );
}

function Body({ mood, halo }: { mood: Mood; halo: boolean }) {
  return (
    <g class="monk-body">
      {halo && (
        <g class="monk-halo">
          <ellipse cx="100" cy="20" rx="42" ry="10" fill="none" stroke={ink} stroke-width="12" />
          <ellipse cx="100" cy="20" rx="42" ry="10" fill="none" stroke="var(--rope)" stroke-width="6" />
        </g>
      )}
      <path d="M36 214 C34 160 58 124 100 124 C142 124 166 160 164 214 Z" fill="var(--robe)" stroke={ink} stroke-width={stroke} stroke-linejoin="round" />
      <path d="M100 152 L100 212" fill="none" stroke="var(--robe-shade)" stroke-width={thin} stroke-linecap="round" />
      <path d="M60 134 C74 154 126 154 140 134 C128 146 72 146 60 134 Z" fill="var(--robe-shade)" stroke={ink} stroke-width={thin} stroke-linejoin="round" />
      <path d="M44 180 C80 190 120 190 156 180" fill="none" stroke="var(--rope)" stroke-width="7" stroke-linecap="round" />
      <path d="M114 188 L120 208 M114 188 L106 206" fill="none" stroke="var(--rope)" stroke-width="5" stroke-linecap="round" />
      <circle cx="100" cy="84" r="50" fill="var(--skin)" stroke={ink} stroke-width={stroke} />
      <path d="M54 92 C51 62 70 42 100 42 C130 42 149 62 146 92" fill="none" stroke="var(--hair)" stroke-width="15" stroke-linecap="round" />
      <ellipse cx="100" cy="54" rx="30" ry="13" fill="var(--skin)" />
      <ellipse cx="88" cy="50" rx="8" ry="4" fill="var(--paper)" opacity="0.7" />
      <Eyes mood={mood} />
      <circle cx="67" cy="108" r="7" fill="var(--cheek)" opacity="0.85" />
      <circle cx="133" cy="108" r="7" fill="var(--cheek)" opacity="0.85" />
      <Mouth mood={mood} />
    </g>
  );
}

const pupils = { happy: [86, 114, 91, 6], focus: [84, 116, 96, 6], oops: [82, 118, 88, 4] } as const;

function Eyes({ mood }: { mood: Mood }) {
  if (mood === "joy") {
    return <path d="M70 92 Q82 76 94 92 M106 92 Q118 76 130 92" fill="none" stroke={ink} stroke-width={stroke} stroke-linecap="round" />;
  }
  if (mood === "sleep") {
    return (
      <g class="monk-sleep">
        <path d="M70 88 Q82 98 94 88 M106 88 Q118 98 130 88" fill="none" stroke={ink} stroke-width={stroke} stroke-linecap="round" />
        <path d="M150 24 h14 l-14 14 h14 M172 6 h10 l-10 10 h10" fill="none" stroke="var(--ink)" stroke-width={thin} stroke-linecap="round" stroke-linejoin="round" />
      </g>
    );
  }
  const [left, right, y, r] = pupils[mood];
  return (
    <g>
      <circle cx="82" cy="88" r="14" fill="var(--paper)" stroke={ink} stroke-width={thin} />
      <circle cx="118" cy="88" r="14" fill="var(--paper)" stroke={ink} stroke-width={thin} />
      <circle cx={left} cy={y} r={r} fill={ink} />
      <circle cx={right} cy={y} r={r} fill={ink} />
      {mood === "oops" && <path d="M72 72 L92 66 M128 72 L108 66" fill="none" stroke={ink} stroke-width={thin} stroke-linecap="round" />}
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case "happy":
      return <path d="M88 114 Q100 126 112 114" fill="none" stroke={ink} stroke-width={thin} stroke-linecap="round" />;
    case "focus":
      return <path d="M92 118 L108 118" fill="none" stroke={ink} stroke-width={thin} stroke-linecap="round" />;
    case "joy":
      return (
        <g>
          <path d="M86 112 Q100 134 114 112 Z" fill={ink} stroke={ink} stroke-width={thin} stroke-linejoin="round" />
          <path d="M93 123 Q100 118 107 123 Q100 130 93 123 Z" fill="var(--cheek)" />
        </g>
      );
    case "oops":
      return <path d="M88 119 Q94 113 100 119 Q106 125 112 119" fill="none" stroke={ink} stroke-width={thin} stroke-linecap="round" />;
    case "sleep":
      return <circle cx="100" cy="118" r="4.5" fill={ink} />;
  }
}

function AccessoryDrawing({ accessory }: { accessory: Accessory }) {
  switch (accessory) {
    case "none":
      return null;
    case "quill":
      return (
        <g class="accessory-quill">
          <path d="M146 156 C151 127 167 104 192 88 C187 117 171 140 146 156 Z" fill="var(--paper)" stroke={ink} stroke-width={thin} stroke-linejoin="round" />
          <path d="M163 130 L172 135 M171 118 L181 121 M166 118 L158 114 M156 138 L149 133" fill="none" stroke={ink} stroke-width="2" stroke-linecap="round" />
          <path d="M120 190 L186 96" fill="none" stroke={ink} stroke-width={thin} stroke-linecap="round" />
          <path d="M118 185 L112 201 L125 191 Z" fill={ink} stroke={ink} stroke-width="2" stroke-linejoin="round" />
        </g>
      );
    case "scissors":
      return (
        <g class="accessory-scissors" transform="translate(150.5 146.5) rotate(25) scale(1.4)">
          <polygon points="5.3,-1.5 -11,-34 -5.3,1.5" fill="var(--paper)" stroke={ink} stroke-width={thin} stroke-linejoin="round" />
          <polygon points="-5.3,-1.5 11,-34 5.3,1.5" fill="var(--paper)" stroke={ink} stroke-width={thin} stroke-linejoin="round" />
          <path d="M-2 3 L-7 12 M2 3 L7 12" fill="none" stroke={ink} stroke-width={thin} stroke-linecap="round" />
          <circle cx="-10" cy="20" r="9" fill="var(--rope)" stroke={ink} stroke-width={thin} />
          <circle cx="10" cy="20" r="9" fill="var(--rope)" stroke={ink} stroke-width={thin} />
          <circle cx="-10" cy="20" r="4" fill="var(--paper)" stroke={ink} stroke-width="1.6" />
          <circle cx="10" cy="20" r="4" fill="var(--paper)" stroke={ink} stroke-width="1.6" />
          <circle cx="0" cy="0" r="2.4" fill={ink} />
        </g>
      );
    case "book":
      return (
        <g class="accessory-book">
          <rect x="66" y="146" width="68" height="46" rx="5" fill="var(--rope)" stroke={ink} stroke-width={thin} />
          <path d="M100 146 L100 192" fill="none" stroke={ink} stroke-width={thin} />
          <path d="M74 158 L92 158 M74 168 L92 168 M108 158 L126 158 M108 168 L126 168" fill="none" stroke="var(--paper)" stroke-width="3" stroke-linecap="round" />
        </g>
      );
    case "loupe":
      return (
        <g class="accessory-loupe">
          <path d="M130 164 L148 142" fill="none" stroke={ink} stroke-width="10" stroke-linecap="round" />
          <circle cx="162" cy="126" r="21" fill="var(--paper)" fill-opacity="0.75" stroke={ink} stroke-width="10" />
          <circle cx="162" cy="126" r="21" fill="none" stroke="var(--rope)" stroke-width="4" />
          <path d="M151 119 Q156 112 164 113" fill="none" stroke={ink} stroke-width="2.5" stroke-linecap="round" />
        </g>
      );
    case "arrows":
      return (
        <g class="accessory-arrows" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M150 46 A60 60 0 0 1 164 108" stroke={ink} stroke-width="13" />
          <path d="M154 100 L164 114 L176 100" stroke={ink} stroke-width="13" />
          <path d="M150 46 A60 60 0 0 1 164 108" stroke="var(--rope)" stroke-width="7" />
          <path d="M154 100 L164 114 L176 100" stroke="var(--rope)" stroke-width="7" />
        </g>
      );
    case "eraser":
      return (
        <g class="accessory-eraser">
          <g transform="rotate(-30 157 150)">
            <rect x="134" y="138" width="46" height="24" rx="4" fill="var(--cheek)" stroke={ink} stroke-width={thin} />
            <rect x="134" y="138" width="20" height="24" rx="4" fill="var(--robe)" stroke={ink} stroke-width={thin} />
            <path d="M139 145 H149" fill="none" stroke="var(--paper)" stroke-width="3" stroke-linecap="round" />
          </g>
          <circle cx="184" cy="170" r="3" fill="var(--cheek)" stroke={ink} stroke-width="1.5" />
          <circle cx="192" cy="160" r="2.5" fill="var(--cheek)" stroke={ink} stroke-width="1.5" />
          <circle cx="178" cy="180" r="2.5" fill="var(--cheek)" stroke={ink} stroke-width="1.5" />
        </g>
      );
    case "frame":
      return (
        <g class="accessory-frame">
          <rect x="136" y="116" width="48" height="40" rx="3" fill="var(--paper)" stroke={ink} stroke-width={thin} />
          <path d="M140 152 L154 134 L164 144 L170 138 L180 152 Z" fill="var(--rope)" />
          <circle cx="170" cy="126" r="4" fill="var(--rope)" />
        </g>
      );
    case "stamp":
      return (
        <g class="accessory-stamp">
          <circle cx="160" cy="104" r="11" fill="var(--rope)" stroke={ink} stroke-width={thin} />
          <rect x="154" y="112" width="12" height="24" rx="3" fill="var(--rope)" stroke={ink} stroke-width={thin} />
          <rect x="138" y="134" width="44" height="16" rx="4" fill="var(--robe-shade)" stroke={ink} stroke-width={thin} />
          <rect x="141" y="150" width="38" height="7" rx="2" fill="var(--rope)" stroke={ink} stroke-width={thin} />
        </g>
      );
    case "stapler":
      return (
        <g class="accessory-stapler">
          <rect x="128" y="170" width="70" height="12" rx="5" fill={ink} />
          <rect x="182" y="165" width="14" height="6" rx="2" fill="var(--paper)" stroke={ink} stroke-width="2" />
          <g transform="rotate(-9 138 166)">
            <path d="M132 166 L132 150 Q132 142 140 142 L190 142 Q198 142 198 150 L198 156 Q198 162 192 162 L140 162 Z" fill="var(--rope)" stroke={ink} stroke-width={thin} stroke-linejoin="round" />
            <path d="M143 148 H186" fill="none" stroke="var(--paper)" stroke-width="3" stroke-linecap="round" opacity="0.8" />
            <rect x="186" y="160" width="10" height="6" rx="1" fill={ink} />
          </g>
          <circle cx="138" cy="166" r="6" fill="var(--paper)" stroke={ink} stroke-width="2.5" />
        </g>
      );
    case "lock":
      return (
        <g class="accessory-lock">
          <path d="M150 128 V116 a11 11 0 0 1 22 0 V128" fill="none" stroke={ink} stroke-width={stroke} stroke-linecap="round" />
          <rect x="142" y="126" width="38" height="30" rx="6" fill="var(--rope)" stroke={ink} stroke-width={thin} />
          <circle cx="161" cy="138" r="4" fill={ink} />
          <path d="M161 140 V148" fill="none" stroke={ink} stroke-width="3" stroke-linecap="round" />
        </g>
      );
    case "sheet":
      return (
        <g class="accessory-sheet" transform="rotate(10 160 130)">
          <path d="M138 100 H170 L182 112 V160 H138 Z" fill="var(--paper)" stroke={ink} stroke-width={thin} stroke-linejoin="round" />
          <path d="M170 100 V112 H182" fill="none" stroke={ink} stroke-width={thin} stroke-linejoin="round" />
          <path d="M146 122 H172 M146 132 H174 M146 142 H164" fill="none" stroke="var(--rope)" stroke-width="3" stroke-linecap="round" />
        </g>
      );
    case "phone":
      return (
        <g class="accessory-phone">
          <g transform="rotate(-10 149 152)">
            <rect x="128" y="116" width="42" height="72" rx="9" fill="var(--rope)" stroke={ink} stroke-width={thin} />
            <rect x="133" y="121" width="20" height="20" rx="5" fill={ink} />
            <circle cx="143" cy="131" r="6" fill="var(--paper)" stroke={ink} stroke-width="2" />
            <circle cx="143" cy="131" r="2.5" fill={ink} />
            <circle cx="161" cy="126" r="2.5" fill="var(--paper)" />
          </g>
          <path d="M176 112 L184 104 M181 122 L191 120 M166 104 L168 94" fill="none" stroke="var(--rope)" stroke-width="4" stroke-linecap="round" />
        </g>
      );
  }
}
