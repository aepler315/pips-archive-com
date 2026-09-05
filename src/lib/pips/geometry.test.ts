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

test("badge sits on the south-east corner of a single cell", () => {
  assert.deepEqual(badgeAnchor(region([[0, 0]])), { x: 1, y: 1 });
  assert.deepEqual(badgeAnchor(region([[2, 3]])), { x: 4, y: 3 });
});

test("badge sits on the south-east corner of a vertical pair", () => {
  assert.deepEqual(badgeAnchor(region([[0, 0], [1, 0]])), { x: 1, y: 2 });
});

test("badge sits on the south-east corner of an L", () => {
  // ##
  // #
  assert.deepEqual(badgeAnchor(region([[0, 0], [0, 1], [1, 0]])), { x: 1, y: 2 });
  // #
  // ##
  assert.deepEqual(badgeAnchor(region([[0, 0], [1, 0], [1, 1]])), { x: 2, y: 2 });
});

test("two regions never share a south-east badge vertex", () => {
  const a = badgeAnchor(region([[0, 0], [1, 0]]));
  const b = badgeAnchor(region([[0, 1]]));
  const c = badgeAnchor(region([[1, 1]]));
  assert.notDeepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.notDeepEqual(b, c);
});
