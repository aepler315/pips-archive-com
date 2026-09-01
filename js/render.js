import { key } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  children.forEach((c) => n.append(c));
  return n;
};

// Pip layouts in a unit square (0..1), for values 0-6.
const PIPS = {
  0: [], 1: [[.5, .5]], 2: [[.25, .25], [.75, .75]], 3: [[.25, .25], [.5, .5], [.75, .75]],
  4: [[.25, .25], [.75, .25], [.25, .75], [.75, .75]],
  5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]],
  6: [[.25, .22], [.75, .22], [.25, .5], [.75, .5], [.25, .78], [.75, .78]],
};

export function pips(x, y, v, cls = 'pip') {
  const g = el('g');
  PIPS[v].forEach(([px, py]) => g.append(el('circle', { cx: x + px, cy: y + py, r: .075, class: cls })));
  return g;
}

// Domino tile spanning unit cells c1 -> c2 (adjacent); pips a at c1, b at c2.
export function tile(c1, c2, a, b, cls = 'tile') {
  const [r1, col1] = c1, [r2, col2] = c2;
  const x = Math.min(col1, col2) + .1, y = Math.min(r1, r2) + .1;
  const w = (col1 === col2 ? 1 : 2) - .2, h = (r1 === r2 ? 1 : 2) - .2;
  const g = el('g');
  g.append(el('rect', { x, y, width: w, height: h, rx: .16, class: cls }));
  const mx = (col1 + col2) / 2 + .5, my = (r1 + r2) / 2 + .5;
  g.append(col1 === col2
    ? el('line', { x1: x + .18, y1: my, x2: x + w - .18, y2: my, class: 'mid' })
    : el('line', { x1: mx, y1: y + .18, x2: mx, y2: y + h - .18, class: 'mid' }));
  g.append(pips(col1, r1, a), pips(col2, r2, b));
  return g;
}

export const labelText = (reg) => ({
  sum: String(reg.target), less: `<${reg.target}`, greater: `>${reg.target}`,
  equals: '=', unequal: '≠', empty: '',
})[reg.type];

// Static board layer: region tints, borders, labels. Returns { svg, cellRects, labels }.
export function boardSvg(puzzle) {
  const pad = .32;
  const svg = el('svg', { viewBox: `${-pad} ${-pad} ${puzzle.cols + 2 * pad} ${puzzle.rows + 2 * pad}`, class: 'board' });
  const cells = el('g'), inner = el('g'), edges = el('g'), tiles = el('g'), labels = el('g'), hits = el('g');
  svg.append(cells, inner, edges, tiles, labels, hits);
  const cellRects = new Map(), hitRects = new Map();
  const regionOf = (r, c) => puzzle.cells.get(key(r, c));
  for (const [k, ri] of puzzle.cells) {
    const [r, c] = k.split(',').map(Number);
    const rect = el('rect', { x: c, y: r, width: 1, height: 1, class: 'cell' });
    cells.append(rect); cellRects.set(k, rect);
    const hit = el('rect', { x: c, y: r, width: 1, height: 1, class: 'hit', 'data-cell': k });
    hits.append(hit); hitRects.set(k, hit);
    const sides = [[r - 1, c, [c, r, c + 1, r]], [r + 1, c, [c, r + 1, c + 1, r + 1]],
                   [r, c - 1, [c, r, c, r + 1]], [r, c + 1, [c + 1, r, c + 1, r + 1]]];
    for (const [nr, nc, [x1, y1, x2, y2]] of sides) {
      const n = regionOf(nr, nc);
      const cls = n === ri ? 'inner' : 'edge';
      if (cls === 'edge' && n !== undefined && (nr < r || nc < c)) continue; // draw shared edges once
      (cls === 'edge' ? edges : inner).append(el('line', { x1, y1, x2, y2, class: cls }));
    }
  }
  for (const reg of puzzle.regions) {
    const t = labelText(reg);
    if (!t) continue;
    const [r, c] = reg.cells.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
    const w = .3 + .18 * t.length;
    const g = el('g');
    g.append(el('rect', { x: c - w / 2 + .02, y: r - .2, width: w, height: .4, rx: .2, class: 'label-bg' }));
    g.append(el('text', { x: c + .02, y: r, class: 'label' }, t));
    labels.append(g);
  }
  return { svg, cellRects, hitRects, tiles };
}

// Tray tile: horizontal 2x1 domino.
export function traySvg(a, b) {
  const svg = el('svg', { viewBox: '0 0 2 1' });
  svg.append(tile([0, 0], [0, 1], a, b));
  return svg;
}
