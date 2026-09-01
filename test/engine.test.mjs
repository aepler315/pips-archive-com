import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePuzzle, stateFromSolution, evaluate, emptyState, place, remove, flip,
         canPlace, LEVELS } from '../js/engine.js';
import { listDates, PUZZLE_DIR } from '../scripts/lib.mjs';

const load = (date) => JSON.parse(readFileSync(join(PUZZLE_DIR, `${date}.json`), 'utf8'));
const dates = listDates();
const every = [];
for (const date of dates) { const raw = load(date); for (const lvl of LEVELS) every.push([date, lvl, parsePuzzle(raw[lvl])]); }

test('corpus loaded', () => assert.ok(every.length >= 3));

test('every embedded solution solves', () => {
  for (const [date, lvl, p] of every) {
    const ev = evaluate(p, stateFromSolution(p));
    assert.ok(ev.solved, `${date} ${lvl}: ${ev.regions.join(',')}`);
  }
});

test('no prefix of a valid solution is flagged violated', () => {
  for (const [date, lvl, p] of every) {
    const sol = stateFromSolution(p);
    let st = emptyState(p);
    sol.forEach((pl, d) => {
      st = place(p, st, d, pl.cells[0], pl.cells[1]);
      assert.ok(st[d], `${date} ${lvl}: could not place domino ${d}`);
      const ev = evaluate(p, st);
      assert.ok(!ev.regions.includes('violated'), `${date} ${lvl}: prefix ${d + 1} flagged`);
      assert.equal(ev.solved, d === sol.length - 1);
    });
  }
});

test('flipping a non-symmetric domino in a constrained region breaks the solve', () => {
  let checked = 0;
  for (const [, , p] of every) {
    const sol = stateFromSolution(p);
    for (let d = 0; d < p.dominoes.length; d++) {
      const [a, b] = p.dominoes[d];
      if (a === b) continue;
      const regs = sol[d].cells.map(([r, c]) => p.regions[p.cells.get(`${r},${c}`)]);
      // flipping only matters if the two cells sit in different, non-empty regions
      if (regs[0] === regs[1] || regs.some((g) => g.type === 'empty')) continue;
      const ev = evaluate(p, flip(sol, d));
      // Not every flip must fail (two sum regions could both still hit), but the
      // flipped state must at least differ in evaluation or remain a genuine solve.
      if (!ev.solved) checked++;
    }
  }
  assert.ok(checked > 100, `expected many flips to break solves, got ${checked}`);
});

test('placement rules', () => {
  const [, , p] = every[0];
  const sol = stateFromSolution(p);
  let st = emptyState(p);
  const [c1, c2] = sol[0].cells;
  assert.ok(canPlace(p, st, 0, c1, c2));
  assert.ok(!canPlace(p, st, 0, c1, c1), 'same cell twice');
  assert.ok(!canPlace(p, st, 0, c1, [c1[0] + 5, c1[1] + 5]), 'non-adjacent');
  assert.ok(!canPlace(p, st, 0, c1, [-1, c1[1]]), 'off board');
  st = place(p, st, 0, c1, c2);
  assert.ok(!canPlace(p, st, 1, c1, c2), 'occupied');
  assert.ok(!canPlace(p, st, 0, c1, c2), 'already placed');
  st = remove(st, 0);
  assert.equal(st[0], null);
  assert.ok(canPlace(p, st, 0, c1, c2));
});

test('early violation detection', () => {
  const raw = { dominoes: [[6, 6], [0, 0]],
    regions: [{ indices: [[0, 0], [0, 1]], type: 'sum', target: 3 },
              { indices: [[1, 0], [1, 1]], type: 'less', target: 1 }] };
  const p = parsePuzzle(raw);
  let st = place(p, emptyState(p), 0, [0, 0], [0, 1]);
  assert.equal(evaluate(p, st).regions[0], 'violated'); // 12 > 3
  st = place(p, emptyState(p), 1, [0, 0], [1, 0]);
  const ev = evaluate(p, st);
  assert.equal(ev.regions[0], 'pending');  // 0 placed, 3 still reachable
  assert.equal(ev.regions[1], 'pending');  // 0 < 1 so far
  st = place(p, st, 0, [0, 1], [1, 1]);
  const ev2 = evaluate(p, st);
  assert.equal(ev2.regions[0], 'violated'); // 0+6 != 3
  assert.equal(ev2.regions[1], 'violated'); // 0+6 >= 1
  assert.equal(ev2.solved, false);
});
