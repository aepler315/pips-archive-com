import { handleHintSearchRequest } from "./hint-search";
import type { HintSearchRequest, HintSearchResponse } from "./hints";

/** A worker can afford a wider search than the main-thread fallback's defaults. */
const WORKER_LIMITS = { nodeBudget: 400_000, deadlineMs: 4_000 };
/** Grace on top of the search deadline before a silent worker counts as failed. */
const REPLY_GRACE_MS = 3_000;

let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<string, (response: HintSearchResponse) => void>();

function settle(response: HintSearchResponse) {
  const resolve = pending.get(response.id);
  pending.delete(response.id);
  resolve?.(response);
}

function hintWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./hint-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<HintSearchResponse>) => settle(event.data);
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      for (const id of [...pending.keys()]) settle({ id, status: "unknown", reason: "worker" });
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Find one verified next move for the board, preferring a background worker. */
export function requestHint(request: Omit<HintSearchRequest, "id">): Promise<HintSearchResponse> {
  const id = `hint-${++seq}`;
  const background = hintWorker();
  if (!background) return Promise.resolve(handleHintSearchRequest({ ...request, id }));
  return new Promise((resolve) => {
    pending.set(id, resolve);
    background.postMessage({ ...WORKER_LIMITS, ...request, id });
    setTimeout(
      () => settle({ id, status: "unknown", reason: "timeout" }),
      (request.deadlineMs ?? WORKER_LIMITS.deadlineMs) + REPLY_GRACE_MS,
    );
  });
}
