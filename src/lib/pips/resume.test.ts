import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyState, parsePuzzle, type GameState } from "./engine.ts";
import { resumeBoard } from "./resume.ts";

const puzzle = parsePuzzle({
  dominoes: [
    [1, 2],
    [3, 3],
  ],
  regions: [
    { indices: [[0, 0]], type: "sum", target: 1 },
    {
      indices: [
        [0, 1],
        [1, 1],
      ],
      type: "sum",
      target: 5,
    },
    { indices: [[1, 0]], type: "sum", target: 3 },
  ],
  solution: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 0],
      [1, 1],
    ],
  ],
});

const solved: GameState = [
  {
    cells: [
      [0, 0],
      [0, 1],
    ],
  },
  {
    cells: [
      [1, 0],
      [1, 1],
    ],
  },
];

test("a saved finished board stays on the board", () => {
  const resumed = resumeBoard(puzzle, solved, true);
  assert.equal(resumed?.reviewing, true);
  assert.deepEqual(resumed?.state, solved);
});

test("a recorded solve with no saved board uses the embedded solution", () => {
  const resumed = resumeBoard(puzzle, null, true);
  assert.equal(resumed?.reviewing, true);
  assert.deepEqual(resumed?.state, solved);
});

test("an empty saved board does not hide a finished puzzle", () => {
  const resumed = resumeBoard(puzzle, emptyState(puzzle), true);
  assert.equal(resumed?.reviewing, true);
  assert.deepEqual(resumed?.state, solved);
});

test("a replay in progress stays unfinished", () => {
  const partial: GameState = [solved[0], null];
  const resumed = resumeBoard(puzzle, partial, true);
  assert.equal(resumed?.reviewing, false);
  assert.deepEqual(resumed?.state, partial);
});

test("an unsaved finish is shown and still needs recording", () => {
  const resumed = resumeBoard(puzzle, solved, false);
  assert.equal(resumed?.reviewing, false);
  assert.deepEqual(resumed?.state, solved);
});

test("an unstarted puzzle stays empty", () => {
  assert.equal(resumeBoard(puzzle, null, false), null);
});
