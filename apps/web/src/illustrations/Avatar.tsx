// AGPL-3.0-or-later with the additional terms in /LICENSE-EXCEPTION.md: the monk is a trademark of Holy PDF's publisher.
import { type Accessory, Monk, type Mood } from "./Monk";

type Props = { accessory: Accessory; mood: Mood; diameter: number; tint: string };

/** Open above the circle's middle, round below it: the robe is cut, the head and the accessory are not. */
export function avatarClip(diameter: number): string {
  const unit = diameter / 80;
  const n = (value: number) => Math.round(value * unit * 100) / 100;
  return `path('M0 0 H${n(100)} V${n(68)} H${n(90)} A${n(40)} ${n(40)} 0 0 1 ${n(10)} ${n(68)} H0 Z')`;
}

export function Avatar({ accessory, mood, diameter, tint }: Props) {
  const unit = diameter / 80;
  const monk = 110 * unit;
  const place = { position: "absolute", left: `${-5 * unit}px`, top: "0" } as const;
  return (
    <span
      class="avatar"
      aria-hidden="true"
      style={{ position: "relative", display: "inline-block", flexShrink: "0", width: `${100 * unit}px`, height: `${112 * unit}px` }}
    >
      <span
        style={{ position: "absolute", left: `${10 * unit}px`, top: `${28 * unit}px`, width: `${diameter}px`, height: `${diameter}px`, borderRadius: "50%", background: tint }}
      />
      <span style={{ position: "absolute", inset: "0", clipPath: avatarClip(diameter) }}>
        <span style={place}>
          <Monk accessory={accessory} mood={mood} size={monk} />
        </span>
      </span>
      <span style={place}>
        <Monk accessory={accessory} mood={mood} size={monk} layer="prop" />
      </span>
    </span>
  );
}
