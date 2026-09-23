import assert from "node:assert/strict";
import { test } from "node:test";
import { shelfDropPayload, shelfDropStatus } from "./shelf-drop.ts";

test("ShelfDrop messages are png files, and the status follows the panel", () => {
  const payload = shelfDropPayload("pips-2026-09-23.png", Uint8Array.from([1, 2]));
  assert.equal(payload.type, "shelfdrop-enqueue");
  assert.equal(payload.mime, "image/png");
  assert.equal(payload.data, btoa(String.fromCharCode(1, 2)));
  assert.equal(shelfDropStatus({ ok: true, panel: "open" }), "Sent to ShelfDrop.");
  assert.equal(
    shelfDropStatus({ ok: true, panel: "closed" }),
    "Sent to ShelfDrop. Open the panel to upload.",
  );
  assert.match(shelfDropStatus({ ok: false, error: "Could not establish connection." }), /Install ShelfDrop/);
  assert.match(shelfDropStatus({ ok: false }), /Reload the extension/);
});
