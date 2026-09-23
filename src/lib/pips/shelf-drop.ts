/** ShelfDrop's pinned extension id. The site can message it only after that extension is installed. */
export const SHELFDROP_EXTENSION_ID = "nchkbkdlbjbngfclonmblogdjbmhndpl";

export type ShelfDropResponse = { ok?: boolean; panel?: "open" | "closed"; error?: string };

type ShelfRuntime = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response: ShelfDropResponse | undefined) => void,
  ) => void;
  lastError?: { message?: string };
};

function encodeBytes(bytes: Uint8Array) {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

export function shelfDropPayload(name: string, bytes: Uint8Array) {
  return { type: "shelfdrop-enqueue", name, mime: "image/png" as const, data: encodeBytes(bytes) };
}

export function shelfDropStatus(response: ShelfDropResponse | null | undefined): string {
  if (!response?.ok) {
    if (/Receiving end does not exist|Could not establish connection/i.test(response?.error ?? ""))
      return "Install ShelfDrop in Chrome, then reload this page.";
    return "Couldn’t reach ShelfDrop. Reload the extension and try again.";
  }
  return response.panel === "open"
    ? "Sent to ShelfDrop."
    : "Sent to ShelfDrop. Open the panel to upload.";
}

function shelfRuntime(): ShelfRuntime | null {
  const runtime = (globalThis as { chrome?: { runtime?: ShelfRuntime } }).chrome?.runtime;
  if (!runtime || typeof runtime.sendMessage !== "function") return null;
  return runtime;
}

export function sendToShelfDrop(name: string, bytes: Uint8Array): Promise<string> {
  const runtime = shelfRuntime();
  if (!runtime) return Promise.resolve(shelfDropStatus({ ok: false, error: "Could not establish connection." }));
  return new Promise((resolve) => {
    try {
      runtime.sendMessage(SHELFDROP_EXTENSION_ID, shelfDropPayload(name, bytes), (response) => {
        const error = runtime.lastError?.message;
        resolve(shelfDropStatus(error ? { ok: false, error } : response));
      });
    } catch {
      resolve(shelfDropStatus({ ok: false }));
    }
  });
}
