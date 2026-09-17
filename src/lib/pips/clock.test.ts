import assert from "node:assert/strict";
import { test } from "node:test";
import { createClock } from "./clock";

test("reading a paused clock never restarts it or counts hidden time", () => {
  const clock = createClock();
  clock.start(1000);
  clock.stop(2000);
  assert.equal(clock.read(2250), 1000);
  assert.equal(clock.read(12250), 1000);
  clock.start(13000);
  assert.equal(clock.read(14000), 2000);
});
test("starting twice does not discard time and stopping twice does not add time", () => {
  const clock = createClock();
  clock.start(1000);
  clock.start(2000);
  clock.stop(3000);
  clock.stop(4000);
  assert.equal(clock.read(5000), 2000);
});
test("restoring an empty saved board preserves elapsed time", () => {
  const clock = createClock();
  clock.restore(12345);
  clock.start(1000);
  assert.equal(clock.read(1500), 12845);
});
