import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePuzzle } from '../js/engine.js';
import { unionPath, colorRegions, badgeAnchor, labelText } from '../js/render.js';

test('unionPath of a square is a closed rounded path', () => {
  const d = unionPath([[0, 0], [0, 1], [1, 0], [1, 1]], 0.2);
  assert.match(d, /^M /);
  assert.match(d, / Z$/);
  assert.equal((d.match(/A /g) || []).length, 4, 'four convex corners');
  assert.ok(!d.includes('NaN'));
});

test('unionPath of a C-shape keeps the notch (not a bounding box)', () => {
  // 2x3 minus the middle-right cell — a C opening to the right.
  const cells = [[0, 0], [0, 1], [1, 0], [2, 0], [2, 1]];
  const d = unionPath(cells, 0.18);
  const box = unionPath([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], 0.18);
  assert.notEqual(d, box, 'notch must not be filled as a bounding box');
  assert.ok(d.length > box.length, 'notched outline has more vertices');
  assert.ok(!d.includes('NaN'));
});

test('unionPath of a plus has concave corners, not rounded blobs', () => {
  const plus = [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]];
  const d = unionPath(plus, 0.2);
  const arcs = (d.match(/A /g) || []).length;
  const corners = (d.match(/ L /g) || []).length;
  assert.equal(arcs, 8, 'eight outer convex corners');
  assert.ok(corners >= 8, 'concave notches stay sharp');
});

test('colorRegions: adjacent constrained regions get different swatches', () => {
  const p = parsePuzzle({
    dominoes: [[1, 2], [3, 4]],
    regions: [
      { indices: [[0, 0], [0, 1]], type: 'sum', target: 3 },
      { indices: [[1, 0], [1, 1]], type: 'less', target: 8 },
    ],
  });
  const assigned = colorRegions(p);
  assert.ok(assigned[0] && assigned[1]);
  assert.notEqual(assigned[0].id, assigned[1].id);
});

test('empty regions are uncolored', () => {
  const p = parsePuzzle({
    dominoes: [[0, 0]],
    regions: [{ indices: [[0, 0], [0, 1]], type: 'empty' }],
  });
  assert.equal(colorRegions(p)[0], null);
});

test('badge sits on the south-east cell corner', () => {
  const p = parsePuzzle({
    dominoes: [[1, 1], [2, 2]],
    regions: [{ indices: [[0, 0], [1, 0], [2, 0], [2, 1]], type: 'sum', target: 4 }],
  });
  assert.deepEqual(badgeAnchor(p.regions[0]), { x: 2, y: 3 });
});

test('labelText matches official constraint glyphs', () => {
  assert.equal(labelText({ type: 'sum', target: 12 }), '12');
  assert.equal(labelText({ type: 'less', target: 4 }), '<4');
  assert.equal(labelText({ type: 'greater', target: 3 }), '>3');
  assert.equal(labelText({ type: 'equals' }), '=');
  assert.equal(labelText({ type: 'unequal' }), '≠');
  assert.equal(labelText({ type: 'empty' }), '');
});
