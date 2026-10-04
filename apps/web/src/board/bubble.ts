import type { EngineError } from "../engine/types";
import type { Mood } from "../illustrations/Monk";
import type { Flow } from "./flow";
import type { Board } from "./state";

export type Bubble =
  | { say: "reading"; name: string }
  | { say: "ready"; files: number; pages: number }
  | { say: "working" }
  | { say: "failed"; error: EngineError };

const moods = { reading: "focus", ready: "happy", working: "focus", failed: "oops" } as const satisfies Record<Bubble["say"], Mood>;

export function bubbleOf(board: Board, flow: Flow): Bubble {
  if (flow.step === "working") return { say: "working" };
  if (flow.step === "setup" && flow.error) return { say: "failed", error: flow.error };
  const opening = board.docs.find((doc) => doc.status.kind === "opening");
  if (opening) return { say: "reading", name: opening.name };
  for (const doc of board.docs) {
    if (doc.status.kind === "failed") return { say: "failed", error: doc.status.error };
  }
  return { say: "ready", files: board.docs.length, pages: board.pages.length };
}

export function moodOf(bubble: Bubble): Mood {
  return moods[bubble.say];
}
