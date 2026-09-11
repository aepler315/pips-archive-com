import assert from "node:assert/strict";
import test from "node:test";
import { displayedGrid, mobileBoardMaxHeight, mobileBoardOrientation } from "./layout";

test("turns only distinctly wide boards on mobile", () => {
  assert.equal(mobileBoardOrientation(3, 9), "clockwise");
  assert.equal(mobileBoardOrientation(2, 7), "clockwise");
  assert.equal(mobileBoardOrientation(2, 4), "natural");
  assert.equal(mobileBoardOrientation(7, 8), "natural");
  assert.equal(mobileBoardOrientation(10, 2), "natural");
});

test("swaps display dimensions for a quarter turn", () => {
  assert.deepEqual(displayedGrid(3, 9, "clockwise"), { rows: 9, cols: 3 });
  assert.deepEqual(displayedGrid(10, 2, "natural"), { rows: 10, cols: 2 });
});

test("sizes board height off a comfortable cell size", () => {
  assert.equal(mobileBoardMaxHeight(4), 302);
  assert.equal(mobileBoardMaxHeight(10), 638);
});
