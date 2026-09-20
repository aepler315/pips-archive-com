import assert from "node:assert/strict";
import test from "node:test";
import sidecar from "../../../data/analysis/2026-09-19.json";
import raw from "../../../data/puzzles/2026-09-19.json";
import type { RawDay } from "./engine";
import { validateDayAnalysis } from "./puzzle-analysis";

test("only matching, supported and numerically valid analysis reaches the UI", async () => {
  const day = raw as unknown as RawDay;
  assert.equal((await validateDayAnalysis(sidecar, day)).easy?.winning.status, "exact");
  for (const mutation of [
    { puzzleHash: "f".repeat(64) },
    { countingVersion: "future" },
    { winning: { status: "exact", count: "0" } },
    { winning: { status: "exact", count: "-1" } },
    { constraintInformationBits: Infinity },
    { date: "2000-01-01" },
  ]) {
    const bad = structuredClone(sidecar);
    Object.assign(bad.analyses.easy, mutation);
    assert.equal((await validateDayAnalysis(bad, day)).easy, undefined);
  }
  assert.deepEqual(await validateDayAnalysis(null, day), {});
  assert.deepEqual(await validateDayAnalysis({ schemaVersion: 999 }, day), {});
});
