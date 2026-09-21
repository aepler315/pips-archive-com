import assert from "node:assert/strict";
import { test } from "node:test";
import { dayClickTarget } from "./day-click";

test("an unsolved day jumps straight to easy", () => {
  assert.deepEqual(dayClickTarget("2026-09-21", 0), {
    kind: "play",
    date: "2026-09-21",
    level: "easy",
  });
});

test("any completed puzzle keeps the day picker", () => {
  assert.deepEqual(dayClickTarget("2026-09-08", 1), { kind: "dialog", date: "2026-09-08" });
  assert.deepEqual(dayClickTarget("2026-09-08", 3), { kind: "dialog", date: "2026-09-08" });
});
