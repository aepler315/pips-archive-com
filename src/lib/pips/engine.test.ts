import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  emptyState,
  key,
  legalNeighbors,
  occupancy,
  openPairs,
  parsePuzzle,
  place,
  placeHighFirst,
  placeHighOn,
  placeLowOn,
  placeOnClick,
  remainderTileable,
  snapPlacement,
  chooseOther,
  placePreferValid,
  preferOpenSeconds,
  placeActive,
  remove,
  rotatePlaced,
  rotateTab,
  validPlacements,
  validSeconds,
  type RawPuzzle,
} from "./engine.ts";

const corridor: RawPuzzle = {
  dominoes: [
    [6, 1],
    [2, 5],
  ],
  regions: [
    {
      type: "empty",
      indices: [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 1],
      ],
    },
  ],
};

test("placeOnClick flips a 5-1 onto a sum-1 cell instead of parking the 5 there", () => {
  const p = parsePuzzle({
    dominoes: [
      [5, 1],
      [2, 2],
    ],
    regions: [
      { type: "sum", target: 1, indices: [[0, 0]] },
      {
        type: "equals",
        indices: [
          [0, 1],
          [0, 2],
        ],
      },
      { type: "empty", indices: [[1, 0]] },
    ],
  });
  const st = emptyState(p);
  const next = placeOnClick(p, st, 0, [0, 0], [0, 1]);
  const occ = occupancy(p, next);
  assert.equal(occ.get(key(0, 0))?.pip, 1);
  assert.equal(occ.get(key(0, 1))?.pip, 5);
});

test("placeHighOn puts the larger pip on the clicked cell for either store order", () => {
  const p = parsePuzzle(corridor);
  const st = emptyState(p);
  const a = placeHighOn(p, st, 0, [0, 1], [0, 0]); // 6-1 stored [6,1]
  assert.equal(occupancy(p, a).get(key(0, 1))?.pip, 6);
  assert.equal(occupancy(p, a).get(key(0, 0))?.pip, 1);
  const b = placeHighOn(p, st, 1, [0, 1], [0, 0]); // 2-5 stored [2,5]
  assert.equal(occupancy(p, b).get(key(0, 1))?.pip, 5);
  assert.equal(occupancy(p, b).get(key(0, 0))?.pip, 2);
});

test("chooseOther uses the only empty neighbor", () => {
  const p = parsePuzzle(corridor);
  const n = chooseOther(p, emptyState(p), 0, [0, 0]);
  assert.deepEqual(n, [0, 1]);
});

test("chooseOther stands a 3-1 up off an equals bar instead of laying it across", () => {
  const p = parsePuzzle({
    dominoes: [
      [3, 1],
      [2, 2],
    ],
    regions: [
      {
        type: "equals",
        indices: [
          [1, 0],
          [1, 1],
          [1, 2],
        ],
      },
      { type: "empty", indices: [[0, 0]] },
    ],
  });
  const other = chooseOther(p, emptyState(p), 0, [1, 0]);
  assert.deepEqual(other, [0, 0]);
  const next = placeHighOn(p, emptyState(p), 0, [1, 0], other!);
  const occ = occupancy(p, next);
  assert.equal(occ.get(key(1, 0))?.pip, 3);
  assert.equal(occ.get(key(0, 0))?.pip, 1);
});

test("placeHighFirst puts the larger pip on the first-clicked cell", () => {
  const p = parsePuzzle(corridor);
  const st = emptyState(p);
  const next = placeHighFirst(p, st, 0, [0, 0], [0, 1]);
  const occ = occupancy(p, next);
  assert.equal(occ.get(key(0, 0))?.pip, 6);
  assert.equal(occ.get(key(0, 1))?.pip, 1);
});

test("placeHighFirst still puts the larger pip first when it is stored second", () => {
  const p = parsePuzzle(corridor);
  const st = emptyState(p);
  const next = placeHighFirst(p, st, 1, [0, 0], [0, 1]); // 2-5, high is 5
  const occ = occupancy(p, next);
  assert.equal(occ.get(key(0, 0))?.pip, 5);
  assert.equal(occ.get(key(0, 1))?.pip, 2);
});

test("legalNeighbors: a dead-end cell has one direction", () => {
  const p = parsePuzzle(corridor);
  const st = emptyState(p);
  const n = legalNeighbors(p, st, 0, [0, 0]);
  assert.deepEqual(n, [[0, 1]]);
});

test("snapPlacement: unique neighbor returns the pair that a click would drop", () => {
  const p = parsePuzzle(corridor);
  const st = emptyState(p);
  const next = snapPlacement(p, st, 0, [0, 0], null);
  assert.ok(next);
  const occ = occupancy(p, next!);
  assert.equal(occ.get(key(0, 0))?.pip, 6);
  assert.equal(occ.get(key(0, 1))?.pip, 1);
});

test("snapPlacement: a junction does not snap", () => {
  const p = parsePuzzle(corridor);
  const st = emptyState(p);
  assert.equal(snapPlacement(p, st, 0, [0, 1], null), null);
});

test("snapPlacement: completing an anchored pair snaps", () => {
  const p = parsePuzzle(corridor);
  const st = emptyState(p);
  const next = snapPlacement(p, st, 0, [0, 2], [0, 1]);
  assert.ok(next?.[0]);
  const cells = next![0]!.cells.map((c) => key(...c)).sort();
  assert.deepEqual(cells, ["0,1", "0,2"]);
});

test("snapPlacement: unique constraint-legal neighbor snaps a double 0 off a sum-2 cell", () => {
  const p = parsePuzzle({
    dominoes: [
      [0, 0],
      [2, 2],
    ],
    regions: [
      { type: "sum", target: 2, indices: [[0, 0]] },
      {
        type: "empty",
        indices: [
          [0, 1],
          [1, 1],
          [1, 0],
        ],
      },
    ],
  });
  const st = emptyState(p);
  const n = legalNeighbors(p, st, 0, [0, 1]);
  assert.equal(n.length, 2);
  const next = snapPlacement(p, st, 0, [0, 1], null);
  assert.ok(next);
  const occ = occupancy(p, next!);
  assert.equal(occ.get(key(0, 1))?.d, 0);
  assert.equal(occ.get(key(1, 1))?.d, 0);
  assert.equal(occ.has(key(0, 0)), false);
});

test("remainderTileable: a leftover singleton is not a whole-domino cover", () => {
  const p = parsePuzzle({
    dominoes: [
      [1, 2],
      [3, 4],
    ],
    regions: [
      {
        type: "empty",
        indices: [
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 1],
        ],
      },
    ],
  });
  let st = emptyState(p);
  st = place(p, st, 0, [0, 0], [0, 1]);
  assert.equal(remainderTileable(p, st), false);
});

test("snapPlacement does not use tiling remainder to pick among several legal neighbors", () => {
  const day = JSON.parse(readFileSync(new URL("../../../public/data/puzzles/2026-08-28.json", import.meta.url), "utf8")) as {
    medium: RawPuzzle;
  };
  const p = parsePuzzle(day.medium);
  const d61 = p.dominoes.findIndex(([a, b]) => a === 6 && b === 1);
  const d54 = p.dominoes.findIndex(([a, b]) => Math.min(a, b) === 4 && Math.max(a, b) === 5);
  assert.ok(d61 >= 0 && d54 >= 0);
  let st = emptyState(p);
  st = place(p, st, d61, [2, 1], [2, 0]);
  const n = legalNeighbors(p, st, d54, [2, 2]);
  assert.ok(n.length > 1);
  assert.equal(snapPlacement(p, st, d54, [2, 2], null, 0), null);
});

test("legalNeighbors: a junction has more than one direction", () => {
  const p = parsePuzzle(corridor);
  const st = emptyState(p);
  const n = legalNeighbors(p, st, 0, [0, 1]);
  assert.equal(n.length, 3);
});

test("place refuses to overwrite an occupied pair", () => {
  const p = parsePuzzle({
    dominoes: [
      [1, 2],
      [3, 4],
    ],
    regions: [
      {
        type: "empty",
        indices: [
          [0, 0],
          [0, 1],
          [1, 0],
          [1, 1],
        ],
      },
    ],
  });
  const st = place(p, emptyState(p), 0, [0, 0], [0, 1]);
  const blocked = place(p, st, 1, [0, 0], [0, 1]);
  assert.equal(blocked, st);
  assert.equal(occupancy(p, blocked).get(key(0, 0))?.d, 0);
  assert.equal(legalNeighbors(p, st, 1, [0, 0]).length, 0);
  assert.deepEqual(legalNeighbors(p, st, 1, [1, 0]), [[1, 1]]);
});

const row: RawPuzzle = {
  dominoes: [
    [6, 1],
    [2, 3],
  ],
  regions: [
    { type: "sum", target: 6, indices: [[0, 0]] },
    {
      type: "empty",
      indices: [
        [0, 1],
        [0, 2],
        [0, 3],
      ],
    },
  ],
};

test("validPlacements: a forced orientation is the only snap", () => {
  const p = parsePuzzle({
    dominoes: [[6, 1]],
    regions: [
      { type: "sum", target: 6, indices: [[0, 0]] },
      { type: "empty", indices: [[0, 1]] },
    ],
  });
  const spots = validPlacements(p, emptyState(p), 0);
  assert.equal(spots.length, 1);
  assert.deepEqual(spots[0], [
    [0, 0],
    [0, 1],
  ]);
});

test("validSeconds ignores empty neighbors that would violate", () => {
  const p = parsePuzzle(row);
  const st = emptyState(p);
  const fromMid = validSeconds(p, st, 0, [0, 1]);
  assert.deepEqual(fromMid, [[0, 2]]);
  const occN = legalNeighbors(p, st, 0, [0, 1]);
  assert.equal(occN.length, 2);
});

test("placePreferValid flips when high-first would violate", () => {
  const p = parsePuzzle({
    dominoes: [[6, 1]],
    regions: [
      { type: "sum", target: 6, indices: [[0, 0]] },
      { type: "empty", indices: [[0, 1]] },
    ],
  });
  const st = emptyState(p);
  // high-first would put 6 on (0,1) and 1 on the sum-6 cell
  const next = placePreferValid(p, st, 0, [0, 1], [0, 0], true);
  const occ = occupancy(p, next);
  assert.equal(occ.get(key(0, 0))?.pip, 6);
  assert.equal(occ.get(key(0, 1))?.pip, 1);
});

test("a 0-cell with one neighbor still places, 0 on the click even if the neighbor region is tight", () => {
  const p = parsePuzzle({
    dominoes: [
      [0, 1],
      [6, 6],
    ],
    regions: [
      { type: "sum", target: 0, indices: [[0, 0]] },
      {
        type: "sum",
        target: 9,
        indices: [
          [1, 0],
          [1, 1],
        ],
      },
      { type: "empty", indices: [[1, 2]] },
    ],
  });
  const st = emptyState(p);
  const n = legalNeighbors(p, st, 0, [0, 0]);
  assert.deepEqual(n, [[1, 0]]);
  const next = placePreferValid(p, st, 0, [0, 0], [1, 0], true);
  const occ = occupancy(p, next);
  assert.equal(occ.get(key(0, 0))?.pip, 0);
  assert.equal(occ.get(key(1, 0))?.pip, 1);
});

test("preferOpenSeconds picks the unconstrained neighbor for a 3-2 on a 2-cell", () => {
  const p = parsePuzzle({
    dominoes: [
      [3, 2],
      [0, 0],
      [6, 6],
      [1, 1],
      [5, 5],
      [0, 3],
    ],
    regions: [
      { type: "equals", indices: [[0, 1], [0, 2]] },
      { type: "empty", indices: [[1, 0]] },
      { type: "empty", indices: [[1, 3]] },
      { type: "sum", target: 2, indices: [[2, 0]] },
      { type: "sum", target: 15, indices: [[2, 3], [3, 3], [4, 3]] },
      { type: "greater", target: 2, indices: [[3, 0], [3, 1], [4, 0]] },
      { type: "empty", indices: [[3, 2]] },
    ],
  });
  const st = emptyState(p);
  const n = legalNeighbors(p, st, 0, [2, 0]);
  assert.equal(n.length, 2);
  const high = preferOpenSeconds(p, st, 0, [2, 0], true);
  const low = preferOpenSeconds(p, st, 0, [2, 0], false);
  assert.equal(high.length, 0);
  assert.deepEqual(low, [[1, 0]]);
  const next = placePreferValid(p, st, 0, [2, 0], [1, 0], false);
  const occ = occupancy(p, next);
  assert.equal(occ.get(key(2, 0))?.pip, 2);
  assert.equal(occ.get(key(1, 0))?.pip, 3);
});

test("openPairs lists the last hole even when both orientations break the region", () => {
  const p = parsePuzzle({
    dominoes: [
      [1, 0],
      [3, 0],
    ],
    regions: [
      { type: "greater", target: 1, indices: [[0, 0]] },
      {
        type: "sum",
        target: 2,
        indices: [
          [1, 0],
          [2, 0],
        ],
      },
      { type: "empty", indices: [[3, 0]] },
    ],
  });
  let st = emptyState(p);
  st = place(p, st, 0, [0, 0], [1, 0]); // 1 on >1, 0 on the 2-region
  const pairs = openPairs(p, st, 1);
  assert.deepEqual(pairs, [
    [
      [2, 0],
      [3, 0],
    ],
  ]);
  const next = placeHighFirst(p, st, 1, [3, 0], [2, 0]);
  const occ = occupancy(p, next);
  assert.equal(occ.get(key(3, 0))?.pip, 3);
  assert.equal(occ.get(key(2, 0))?.pip, 0);
});

test("rotatePlaced turns 90 onto a free stub, keeping the pivot pip", () => {
  const p = parsePuzzle(corridor);
  let st = emptyState(p);
  st = place(p, st, 0, [0, 0], [0, 1]); // 6 at 0,0  1 at 0,1
  st = rotatePlaced(p, st, 0);
  const occ = occupancy(p, st);
  assert.equal(occ.get(key(0, 1))?.pip, 1);
  assert.equal(occ.get(key(1, 1))?.pip, 6);
  assert.equal(occ.has(key(0, 0)), false);
});

test("rotatePlaced flips 180 when no 90° landing exists", () => {
  const p = parsePuzzle({
    dominoes: [
      [6, 1],
      [2, 3],
    ],
    regions: [
      { type: "empty", indices: [[0, 0], [0, 1]] },
      { type: "empty", indices: [[2, 0], [2, 1]] },
    ],
  });
  let st = emptyState(p);
  st = place(p, st, 0, [0, 0], [0, 1]);
  st = rotatePlaced(p, st, 0);
  const occ = occupancy(p, st);
  assert.equal(occ.get(key(0, 0))?.pip, 1);
  assert.equal(occ.get(key(0, 1))?.pip, 6);
});

test("rotateTab second press flips in place without moving", () => {
  const p = parsePuzzle(corridor);
  let st = emptyState(p);
  st = place(p, st, 0, [0, 0], [0, 1]);
  st = rotateTab(p, st, 0, 0);
  const after90 = [...occupancy(p, st).keys()].sort();
  assert.deepEqual(after90, ["0,1", "1,1"]);
  const pipA = occupancy(p, st).get(key(0, 1))?.pip;
  const pipB = occupancy(p, st).get(key(1, 1))?.pip;
  st = rotateTab(p, st, 0, 1);
  const occ = occupancy(p, st);
  assert.deepEqual([...occ.keys()].sort(), after90);
  assert.equal(occ.get(key(0, 1))?.pip, pipB);
  assert.equal(occ.get(key(1, 1))?.pip, pipA);
});

test("snapPlacement rotates into the only constraint-legal orientation", () => {
  const p = parsePuzzle({
    dominoes: [
      [4, 1],
      [2, 2],
    ],
    regions: [
      { type: "sum", target: 1, indices: [[0, 0]] },
      { type: "empty", indices: [[0, 1], [2, 0], [2, 1]] },
    ],
  });
  const st = emptyState(p);
  const next = snapPlacement(p, st, 0, [0, 0], null, 0);
  assert.ok(next);
  const occ = occupancy(p, next!);
  assert.equal(occ.get(key(0, 0))?.pip, 1);
  assert.equal(occ.get(key(0, 1))?.pip, 4);
});

test("snapPlacement last 4-1 flips even when the 4 was the selected pip", () => {
  const p = parsePuzzle({
    dominoes: [
      [4, 1],
      [2, 2],
    ],
    regions: [
      { type: "sum", target: 1, indices: [[0, 0]] },
      { type: "sum", target: 4, indices: [[0, 1]] },
      { type: "empty", indices: [[1, 0], [1, 1]] },
    ],
  });
  let st = emptyState(p);
  st = place(p, st, 1, [1, 0], [1, 1]);
  const next = snapPlacement(p, st, 0, [0, 0], null, 0);
  assert.ok(next);
  const occ = occupancy(p, next!);
  assert.equal(occ.get(key(0, 0))?.pip, 1);
  assert.equal(occ.get(key(0, 1))?.pip, 4);
});

test("placeActive puts stored half end on the clicked cell", () => {
  const p = parsePuzzle(corridor);
  const st = emptyState(p);
  const a = placeActive(p, st, 0, [0, 0], [0, 1], 0);
  assert.equal(occupancy(p, a).get(key(0, 0))?.pip, 6);
  assert.equal(occupancy(p, a).get(key(0, 1))?.pip, 1);
  const b = placeActive(p, st, 0, [0, 0], [0, 1], 1);
  assert.equal(occupancy(p, b).get(key(0, 0))?.pip, 1);
  assert.equal(occupancy(p, b).get(key(0, 1))?.pip, 6);
});



