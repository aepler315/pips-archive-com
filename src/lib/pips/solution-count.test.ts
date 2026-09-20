import assert from "node:assert/strict";
import test from "node:test";
import type { Cell, RawPuzzle } from "./engine";
import { free, oneEdge, oracleCount, square } from "./solution-count.fixtures";

test("oracle counts hand-checkable arrangements without tile-copy permutations", () => {
  assert.equal(oracleCount(free([[1, 2]], oneEdge)), 2n);
  assert.equal(oracleCount(free([[2, 2]], oneEdge)), 1n);
  assert.equal(
    oracleCount(
      free(
        [
          [0, 0],
          [0, 0],
        ],
        square,
      ),
    ),
    2n,
  );
  assert.equal(
    oracleCount({ dominoes: [[1, 2]], regions: [{ type: "sum", indices: oneEdge, target: 4 }] }),
    0n,
  );
});

test("oracle applies strict sum inequalities and equality rules", () => {
  const constrained = (
    type: "less" | "greater" | "equals" | "sum",
    target?: number,
  ): RawPuzzle => ({
    dominoes: [[1, 2]],
    regions: [{ type, indices: oneEdge, ...(target == null ? {} : { target }) }],
  });

  assert.equal(oracleCount(constrained("less", 4)), 2n);
  assert.equal(oracleCount(constrained("less", 3)), 0n);
  assert.equal(oracleCount(constrained("greater", 2)), 2n);
  assert.equal(oracleCount(constrained("greater", 3)), 0n);
  assert.equal(oracleCount(constrained("sum", 3)), 2n);
  assert.equal(oracleCount(constrained("equals")), 0n);
});

test("oracle keeps distinct boundaries even when all displayed pips match", () => {
  assert.equal(
    oracleCount(
      free(
        [
          [1, 1],
          [1, 1],
        ],
        square,
      ),
    ),
    2n,
  );
});

test("oracle normalizes reversed duplicate domino types", () => {
  assert.equal(
    oracleCount(
      free(
        [
          [1, 2],
          [2, 1],
        ],
        square,
      ),
    ),
    8n,
  );
  assert.equal(
    oracleCount(
      free(
        [
          [2, 1],
          [1, 2],
        ],
        square,
      ),
    ),
    8n,
  );
});

test("oracle handles disconnected boards, zero pips, and impossible tilings", () => {
  const disconnected: Cell[] = [
    [0, 0],
    [0, 1],
    [2, 0],
    [2, 1],
  ];
  assert.equal(
    oracleCount(
      free(
        [
          [0, 0],
          [1, 2],
        ],
        disconnected,
      ),
    ),
    4n,
  );
  assert.equal(oracleCount(free([[0, 0]], oneEdge)), 1n);
  assert.equal(
    oracleCount(
      free(
        [
          [0, 0],
          [1, 1],
        ],
        [
          [0, 0],
          [0, 1],
          [2, 0],
          [4, 0],
        ],
      ),
    ),
    0n,
  );
});

test("translation and input ordering preserve counts", () => {
  const translated: Cell[] = square.map(([row, column]) => [row + 10, column + 20]);
  const reordered: Cell[] = [square[3], square[1], square[2], square[0]];
  assert.equal(
    oracleCount(
      free(
        [
          [1, 2],
          [1, 2],
        ],
        square,
      ),
    ),
    8n,
  );
  assert.equal(
    oracleCount(
      free(
        [
          [2, 1],
          [1, 2],
        ],
        reordered,
      ),
    ),
    8n,
  );
  assert.equal(
    oracleCount(
      free(
        [
          [1, 2],
          [2, 1],
        ],
        translated,
      ),
    ),
    8n,
  );
});
