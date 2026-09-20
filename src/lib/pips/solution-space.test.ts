import assert from "node:assert/strict";
import test from "node:test";
import september19 from "../../../data/puzzles/2026-09-19.json" with { type: "json" };
import type { RawPuzzle } from "./engine";
import { free, oneEdge, oracleCount, square } from "./solution-count.fixtures";
import { countWinningArrangements, hashPuzzle } from "./solution-count";
import { constraintInformationBits, countUnconstrainedArrangements } from "./solution-space";

const exact = (result: ReturnType<typeof countWinningArrangements>) => {
  assert.equal(result.status, "exact");
  return result.count;
};

test("production counter matches the independent oracle on hand-counted boards", () => {
  const cases: RawPuzzle[] = [
    free([[1, 2]], oneEdge),
    free([[2, 2]], oneEdge),
    free(
      [
        [0, 0],
        [0, 0],
      ],
      square,
    ),
    { dominoes: [[1, 2]], regions: [{ type: "sum", indices: oneEdge, target: 4 }] },
  ];
  for (const raw of cases) {
    assert.equal(exact(countWinningArrangements(raw)), oracleCount(raw).toString());
  }
});

test("production counter preserves oracle counts for deterministic small generated puzzles", () => {
  let state = 0x5eed1234;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
  for (let index = 0; index < 24; index++) {
    const raw = free(
      [
        [next() % 4, next() % 4],
        [next() % 4, next() % 4],
      ],
      square,
    );
    assert.equal(
      exact(countWinningArrangements(raw)),
      oracleCount(raw).toString(),
      `fixture ${index}`,
    );
  }
});

test("unconstrained arrangements use geometry, multiplicity, and orientation factors exactly", () => {
  assert.deepEqual(countUnconstrainedArrangements(free([[1, 2]], oneEdge)), {
    status: "exact",
    count: "2",
  });
  assert.deepEqual(
    countUnconstrainedArrangements(
      free(
        [
          [0, 0],
          [0, 0],
        ],
        square,
      ),
    ),
    {
      status: "exact",
      count: "2",
    },
  );
  assert.deepEqual(
    countUnconstrainedArrangements(
      free(
        [
          [1, 2],
          [2, 1],
        ],
        square,
      ),
    ),
    {
      status: "exact",
      count: "8",
    },
  );
});

test("constraint information stays in log space and rejects incomplete or zero counts", () => {
  assert.equal(
    constraintInformationBits({ status: "exact", count: "1" }, { status: "exact", count: "8" }),
    3,
  );
  assert.equal(
    constraintInformationBits({ status: "exact", count: "0" }, { status: "exact", count: "8" }),
    null,
  );
  assert.equal(
    constraintInformationBits(
      { status: "bounded", lowerBound: "1", reason: "node-budget" },
      { status: "exact", count: "8" },
    ),
    null,
  );
});

test("interrupted counts return a lower bound instead of a false exact zero", () => {
  assert.deepEqual(countWinningArrangements(free([[1, 2]], oneEdge), { nodeBudget: 0 }), {
    status: "bounded",
    lowerBound: "0",
    reason: "node-budget",
  });
  assert.deepEqual(
    countWinningArrangements(free([[1, 2]], oneEdge), { deadlineMs: 0, now: () => 0 }),
    {
      status: "bounded",
      lowerBound: "0",
      reason: "time-budget",
    },
  );
  assert.deepEqual(countWinningArrangements(free([[1, 2]], oneEdge), { memoEntryBudget: 0 }), {
    status: "bounded",
    lowerBound: "0",
    reason: "memory-budget",
  });
});

test("normalization ignores input ordering but invalidates a changed rule", async () => {
  const original: RawPuzzle = free(
    [
      [1, 2],
      [3, 4],
    ],
    square,
  );
  const reordered: RawPuzzle = free(
    [
      [4, 3],
      [2, 1],
    ],
    [square[3], square[1], square[2], square[0]],
  );
  const constrained: RawPuzzle = {
    ...original,
    regions: [{ type: "sum", indices: square, target: 10 }],
  };
  assert.equal(await hashPuzzle(original), await hashPuzzle(reordered));
  assert.notEqual(await hashPuzzle(original), await hashPuzzle(constrained));
});

test("September 19 production payload matches independently established counts", () => {
  const day = september19 as unknown as Record<"easy" | "medium" | "hard", RawPuzzle>;
  assert.deepEqual(countWinningArrangements(day.easy), { status: "exact", count: "3" });
  assert.deepEqual(countWinningArrangements(day.medium), { status: "exact", count: "1" });
  assert.deepEqual(countWinningArrangements(day.hard), { status: "exact", count: "2" });
  assert.deepEqual(countUnconstrainedArrangements(day.easy), { status: "exact", count: "3840" });
  assert.deepEqual(countUnconstrainedArrangements(day.medium), {
    status: "exact",
    count: "5160960",
  });
  assert.deepEqual(countUnconstrainedArrangements(day.hard), {
    status: "exact",
    count: "42849873690624000",
  });
});

test("pruning matches oracle across strict sums, equality and disconnected cells", () => {
  const types = ["empty", "sum", "less", "greater", "equals", "unequal"] as const;
  let seed = 937;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  for (let i = 0; i < 120; i++) {
    const raw: RawPuzzle = {
      dominoes: [
        [next() % 7, next() % 7],
        [next() % 7, next() % 7],
      ],
      regions: [{ type: types[i % 6], target: next() % 20, indices: square }],
    };
    const s = countWinningArrangements(raw),
      u = countUnconstrainedArrangements(raw);
    assert.equal(exact(s), oracleCount(raw).toString(), JSON.stringify(raw));
    assert.ok(BigInt(exact(s)) <= BigInt(exact(u)));
  }
});
