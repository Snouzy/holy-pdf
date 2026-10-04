import type { ScanFailure, ScanReply, ScanRequest, ScanResult } from "./protocol";

export type ScanOutcome = { ok: true; value: ScanResult } | { ok: false; error: ScanFailure };
export type Scanner = { scan(request: ScanRequest, urgent?: boolean): Promise<ScanOutcome> };

type Waiting = { request: ScanRequest; resolve: (outcome: ScanOutcome) => void };

/**
 * One page at a time: two photos decoded at once would not fit in a phone's memory. An urgent request, a page the
 * visitor is correcting, goes before the photos still waiting to be imported.
 */
export function createScanner(makeWorker: () => Worker): Scanner {
  const queue: Waiting[] = [];
  let worker: Worker | undefined;
  let running = false;
  let next = 0;

  function run() {
    if (running) return;
    const waiting = queue.shift();
    if (!waiting) return;
    running = true;
    const id = ++next;
    const current = (worker ??= makeWorker());
    const finish = (outcome: ScanOutcome) => {
      current.removeEventListener("message", onMessage);
      current.removeEventListener("error", onError);
      running = false;
      waiting.resolve(outcome);
      run();
    };
    const onMessage = ({ data }: MessageEvent<ScanReply>) => {
      if (data.id === id) finish(data.ok ? { ok: true, value: data.value } : { ok: false, error: data.error });
    };
    // A worker that failed to start or ran out of memory is replaced for the next page.
    const onError = () => {
      current.terminate();
      worker = undefined;
      finish({ ok: false, error: "engineUnavailable" });
    };
    current.addEventListener("message", onMessage);
    current.addEventListener("error", onError);
    current.postMessage({ id, request: waiting.request }, [waiting.request.photo]);
  }

  return {
    scan(request, urgent = false) {
      return new Promise((resolve) => {
        (urgent ? queue.unshift.bind(queue) : queue.push.bind(queue))({ request, resolve });
        run();
      });
    },
  };
}
