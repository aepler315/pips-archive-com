import assert from "node:assert/strict";
import test from "node:test";
import { profilePuzzle } from "./puzzle-complexity";
import { free, square } from "./solution-count.fixtures";
test("eight independent seeded first-solution traces ignore supplied answers and ordering", async () => {
  const raw = free(
    [
      [1, 2],
      [2, 1],
    ],
    square,
  );
  const a = await profilePuzzle(raw);
  const b = await profilePuzzle({
    ...raw,
    dominoes: [
      [2, 1],
      [1, 2],
    ],
    regions: [{ type: "empty", indices: [...square].reverse() }],
    solution: [
      [
        [99, 99],
        [99, 98],
      ],
    ],
  });
  assert.deepEqual(a, b);
  assert.equal(a.status, "complete");
  assert.equal(a.traces.length, 8);
  assert.ok(a.medianFirstSolutionNodes! <= 3);
  assert.equal(a.percentile, null);
  const bounded = await profilePuzzle(raw, { nodeBudget: 0 });
  assert.equal(bounded.status, "bounded");
  assert.equal(bounded.medianFirstSolutionNodes, null);
});
