import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCalibration, type CalibrationSample } from "./performance-calibration";
import { LEVELS } from "./engine";
const samples: CalibrationSample[] = Array.from({ length: 150 }, (_, i) => ({
  date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
  solvedAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
  level: LEVELS[i % 3],
  first: 1000 * Math.exp(2 + (i % 7) * 0.2),
  puzzleHash: "a".repeat(64),
  analysisHash: "a".repeat(64),
  dominoCount: 5 + (i % 7),
  firstSolutionNodes: 10 + (i % 7),
  rootForcedFraction: 0.5,
}));
test("eligibility requires enough total, per-level and chronological holdout evidence", () => {
  assert.equal(evaluateCalibration(samples.slice(0, 119)).status, "insufficient");
  assert.equal(
    evaluateCalibration(samples.map((s) => ({ ...s, level: "easy" }))).status,
    "insufficient",
  );
  assert.equal(
    evaluateCalibration(samples.map((s) => ({ ...s, analysisHash: "b".repeat(64) }))).status,
    "insufficient",
  );
});
test("training normalization and coefficients never read holdout outcomes", () => {
  const a = evaluateCalibration(samples);
  const changed = samples.map((s, i) => (i >= 120 ? { ...s, first: s.first * 100 } : s));
  const b = evaluateCalibration(changed);
  assert.notEqual(a.status, "insufficient");
  assert.notEqual(b.status, "insufficient");
  if (a.status === "insufficient" || b.status === "insufficient") return;
  assert.deepEqual(a.epoch.coefficients, b.epoch.coefficients);
  assert.deepEqual(a.epoch.means, b.epoch.means);
  assert.notEqual(a.candidateError, b.candidateError);
  assert.equal(a.activeModel, "level-anchor-v1");
  assert.equal(a.epoch.trainingCutoff, samples[119].solvedAt);
});

test("a future duplicate cannot replace an immutable training observation", () => {
  const before = evaluateCalibration(samples);
  const after = evaluateCalibration([
    ...samples,
    { ...samples[0], solvedAt: "2027-01-01T00:00:00.000Z", dominoCount: 500 },
  ]);
  assert.deepEqual(after, before);
});
