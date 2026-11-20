import assert from "node:assert/strict";
import { test } from "node:test";
import { backAction, encodeFile, validExportName } from "../mobile/policy.ts";

test("Android Back dismisses an overlay before leaving the puzzle", () => {
  assert.equal(backAction(true, true, "/play/2026-09-19/easy"), "dismiss");
  assert.equal(backAction(false, true, "/play/2026-09-19/easy"), "back");
  assert.equal(backAction(false, false, "/play/2026-09-19/easy"), "home");
  assert.equal(backAction(false, false, "/"), "minimize");
});

test("native exports preserve arbitrary UTF-8 and binary bytes", async () => {
  for (const blob of [
    new Blob(['{"name":"🎲 café"}']),
    new Blob([new Uint8Array([0, 128, 255, 10])]),
  ]) {
    const encoded = await encodeFile(blob);
    assert.deepEqual(Buffer.from(encoded, "base64"), Buffer.from(await blob.arrayBuffer()));
  }
});

test("export filenames cannot escape the app cache", () => {
  assert.equal(validExportName("pips-2026-10-14.png"), true);
  for (const name of ["../secrets.json", "a/b.json", "a\\b.json", "", "name\u0000.json"])
    assert.equal(validExportName(name), false);
});
