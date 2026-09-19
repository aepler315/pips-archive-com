import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDailyResults } from "./daily-results";
import * as sharing from "./result-sharing";
const result = (first: number) => ({
  first,
  best: 0,
  plays: 2,
  solvedAt: "2026-09-19T00:00:00Z",
  lastAt: "2026-09-19T00:00:00Z",
});
test("complete daily sharing has exactly four date-stable lines using first times", async () => {
  assert.equal(typeof sharing.buildDailyShareText, "function");
  const summary = buildDailyResults("2026-09-19", {
    easy: result(62000),
    medium: result(125000),
    hard: result(245000),
  });
  const expected = "Pips 09/19/2026\nEasy: 01:02\nMedium: 02:05\nHard: 04:05";
  assert.equal(sharing.buildDailyShareText(summary), expected);
  let copied = "";
  await sharing.copyDailyResults(expected, {
    writeText: async (text) => {
      copied = text;
    },
  });
  assert.equal(copied, expected);
  await assert.rejects(
    sharing.copyDailyResults(expected, {
      writeText: async () => {
        throw new Error("denied");
      },
    }),
    /denied/,
  );
});
test("sharing refuses missing difficulty lines and preserves valid zero times", () => {
  assert.throws(() =>
    sharing.buildDailyShareText(
      buildDailyResults("2026-09-19", { easy: result(0), medium: null, hard: null }),
    ),
  );
  assert.equal(
    sharing.buildDailyShareText(
      buildDailyResults("2026-09-19", { easy: result(0), medium: result(0), hard: result(0) }),
    ),
    "Pips 09/19/2026\nEasy: 00:00\nMedium: 00:00\nHard: 00:00",
  );
});
