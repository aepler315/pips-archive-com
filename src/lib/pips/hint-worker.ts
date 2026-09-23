import { handleHintSearchRequest } from "./hint-search";
import type { HintSearchRequest } from "./hints";

// Runs the bounded completion search off the main thread so the board stays responsive.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<HintSearchRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};
scope.onmessage = (event) => scope.postMessage(handleHintSearchRequest(event.data));
