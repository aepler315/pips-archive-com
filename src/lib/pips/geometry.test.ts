import assert from "node:assert/strict";
import { test } from "node:test";
import { badgeAnchor } from "./geometry.ts";
import type { Region } from "./engine.ts";

const region = (cells: [number, number][]): Region => ({
  id: 0,
  type: "sum",
  target: 1,
  cells,
});

// Mirrors BADGE_CORNER_PULL in geometry.ts: how far the badge sits back from
// the raw grid corner, onto the region's own southeasternmost cell.
const PULL = 0.1;

test("badge sits near the south-east corner of a single cell, pulled onto its own fill", () => {
  assert.deepEqual(badgeAnchor(region([[0, 0]])), { x: 1 - PULL, y: 1 - PULL });
  assert.deepEqual(badgeAnchor(region([[2, 3]])), { x: 4 - PULL, y: 3 - PULL });
});

test("badge sits near the south-east corner of a vertical pair", () => {
  assert.deepEqual(badgeAnchor(region([[0, 0], [1, 0]])), { x: 1 - PULL, y: 2 - PULL });
});

test("badge sits near the south-east corner of an L", () => {
  // ##
  // #
  assert.deepEqual(badgeAnchor(region([[0, 0], [0, 1], [1, 0]])), { x: 1 - PULL, y: 2 - PULL });
  // #
  // ##
  assert.deepEqual(badgeAnchor(region([[0, 0], [1, 0], [1, 1]])), { x: 2 - PULL, y: 2 - PULL });
});

test("two regions never share a south-east badge vertex", () => {
  const a = badgeAnchor(region([[0, 0], [1, 0]]));
  const b = badgeAnchor(region([[0, 1]]));
  const c = badgeAnchor(region([[1, 1]]));
  assert.notDeepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.notDeepEqual(b, c);
});
