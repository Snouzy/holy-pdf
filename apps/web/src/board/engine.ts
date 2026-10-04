import { createEngine } from "../engine/client";

export const engine = createEngine(() => new Worker(new URL("../engine/worker.ts", import.meta.url), { type: "module" }));
