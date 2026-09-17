import assert from "node:assert/strict";
import { test } from "node:test";
import { createArchiveStore, archiveIsBehind } from "./archive";
import type { ArchiveIndex } from "./types";

const level = { rows: 2, cols: 2, cells: 4, dominoes: 2 };
const entry = (date: string) => ({ date, levels: { easy: level, medium: level, hard: level } });
const initial: ArchiveIndex = {
  first: "2026-09-15",
  last: "2026-09-15",
  count: 1,
  puzzles: [entry("2026-09-15")],
};
const latest: ArchiveIndex = {
  first: "2026-09-15",
  last: "2026-09-16",
  count: 2,
  puzzles: [entry("2026-09-15"), entry("2026-09-16")],
};

test("refresh makes a newly published date available without replacing the server snapshot", async () => {
  const store = createArchiveStore(initial, async () => Response.json(latest));
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  await store.refresh();
  assert.equal(store.getSnapshot().last, "2026-09-16");
  assert.equal(store.getServerSnapshot(), initial);
  assert.equal(changes, 1);
  unsubscribe();
});
test("invalid, failed, and older responses preserve the last good archive", async () => {
  let response = Response.json(latest);
  const store = createArchiveStore(initial, async () => response);
  await store.refresh();
  for (const data of [
    { ...latest, count: 20 },
    { ...latest, puzzles: [entry("2026-02-30")] },
    initial,
  ]) {
    response = Response.json(data);
    await store.refresh();
    assert.equal(store.getSnapshot().last, "2026-09-16");
    assert.equal(store.getSnapshot().count, 2);
  }
  response = new Response(null, { status: 503 });
  await store.refresh();
  assert.equal(store.getSnapshot().last, "2026-09-16");
});
test("simultaneous refreshes share one request and unchanged content does not notify", async () => {
  let calls = 0;
  const store = createArchiveStore(initial, async () => {
    calls++;
    return Response.json(initial);
  });
  let changes = 0;
  store.subscribe(() => changes++);
  await Promise.all([store.refresh(), store.refresh()]);
  assert.equal(calls, 1);
  assert.equal(changes, 0);
});
test("freshness changes at New York midnight in either DST regime", () => {
  assert.equal(archiveIsBehind(initial, new Date("2026-09-16T03:59:59Z")), false);
  assert.equal(archiveIsBehind(initial, new Date("2026-09-16T04:00:00Z")), true);
  const winter = { ...initial, last: "2026-12-15" };
  assert.equal(archiveIsBehind(winter, new Date("2026-12-16T04:59:59Z")), false);
  assert.equal(archiveIsBehind(winter, new Date("2026-12-16T05:00:00Z")), true);
});
