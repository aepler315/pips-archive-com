import { key } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    n.setAttribute(k, v);
  }
  children.forEach((c) => n.append(c));
  return n;
};

// Pip layouts in a unit square (0..1), for values 0-6.
const PIPS = {
  0: [], 1: [[.5, .5]], 2: [[.28, .28], [.72, .72]], 3: [[.28, .28], [.5, .5], [.72, .72]],
  4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]],
  5: [[.28, .28], [.72, .28], [.5, .5], [.28, .72], [.72, .72]],
  6: [[.28, .24], [.72, .24], [.28, .5], [.72, .5], [.28, .76], [.72, .76]],
};

export function pips(x, y, v, cls = 'pip') {
  const g = el('g');
  (PIPS[v] ?? []).forEach(([px, py]) => g.append(el('circle', { cx: x + px, cy: y + py, r: .09, class: cls })));
  return g;
}

// Domino tile spanning unit cells c1 -> c2 (adjacent); pips a at c1, b at c2.
export function tile(c1, c2, a, b, cls = 'tile') {
  const [r1, col1] = c1, [r2, col2] = c2;
  const inset = .08;
  const x = Math.min(col1, col2) + inset, y = Math.min(r1, r2) + inset;
  const w = (col1 === col2 ? 1 : 2) - inset * 2, h = (r1 === r2 ? 1 : 2) - inset * 2;
  const g = el('g');
  g.append(el('rect', { x, y, width: w, height: h, rx: .16, class: cls }));
  const mx = (col1 + col2) / 2 + .5, my = (r1 + r2) / 2 + .5;
  g.append(col1 === col2
    ? el('line', { x1: x + .14, y1: my, x2: x + w - .14, y2: my, class: 'mid' })
    : el('line', { x1: mx, y1: y + .14, x2: mx, y2: y + h - .14, class: 'mid' }));
  g.append(pips(col1, r1, a), pips(col2, r2, b));
  return g;
}

export const labelText = (reg) => ({
  sum: String(reg.target), less: `<${reg.target}`, greater: `>${reg.target}`,
  equals: '=', unequal: '≠', empty: '',
})[reg.type];

const EMPTY_SWATCH = { id: 'empty', fill: '#F6F1E6', dash: '#C9BBA8', badge: '#8A7D6C' };
const PALETTE = [
  { id: 'pink',   fill: '#F3B6CE', dash: '#C45A86', badge: '#D63F7A' },
  { id: 'violet', fill: '#C9B6F2', dash: '#7A58C4', badge: '#6A45C0' },
  { id: 'blue',   fill: '#B3C6F4', dash: '#4A6BB8', badge: '#3558B0' },
  { id: 'mint',   fill: '#B4E0C6', dash: '#3D9A68', badge: '#2B8A55' },
  { id: 'peach',  fill: '#F4C3A4', dash: '#D0703C', badge: '#C85A28' },
  { id: 'teal',   fill: '#A6DDD6', dash: '#2E8A82', badge: '#1C7A72' },
  { id: 'lemon',  fill: '#E8DC96', dash: '#B49A28', badge: '#A08818' },
  { id: 'sky',    fill: '#A6D4EE', dash: '#3A86B4', badge: '#2478A8' },
  { id: 'lilac',  fill: '#D8BFE6', dash: '#8A5AA8', badge: '#7A4898' },
  { id: 'coral',  fill: '#F0B0AE', dash: '#C0504E', badge: '#B03C3C' },
  { id: 'sage',   fill: '#C5DCA8', dash: '#6A9440', badge: '#5A8430' },
  { id: 'navy',   fill: '#A8B4D8', dash: '#4A5A90', badge: '#3A4A80' },
];

function regionAdj(puzzle) {
  const adj = puzzle.regions.map(() => []);
  for (const [k, ri] of puzzle.cells) {
    const [r, c] = k.split(',').map(Number);
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const nj = puzzle.cells.get(key(r + dr, c + dc));
      if (nj === undefined || nj === ri) continue;
      if (!adj[ri].includes(nj)) adj[ri].push(nj);
      if (!adj[nj].includes(ri)) adj[nj].push(ri);
    }
  }
  return adj;
}

/** Greedy coloring so neighboring constrained regions never share a swatch. */
export function colorRegions(puzzle) {
  const adj = regionAdj(puzzle);
  const assigned = puzzle.regions.map(() => null);
  for (const reg of puzzle.regions) {
    if (reg.type === 'empty') continue;
    const used = new Set(adj[reg.id].map((i) => assigned[i]?.id).filter(Boolean));
    assigned[reg.id] = PALETTE.find((s) => !used.has(s.id)) ?? PALETTE[reg.id % PALETTE.length];
  }
  return assigned;
}

export const swatchFor = (assigned, ri) => assigned[ri] ?? EMPTY_SWATCH;

function directedEdges(cells) {
  const set = new Set(cells.map(([r, c]) => key(r, c)));
  const has = (r, c) => set.has(key(r, c));
  const edges = [];
  for (const [r, c] of cells) {
    if (!has(r - 1, c)) edges.push({ x1: c,     y1: r,     x2: c + 1, y2: r });
    if (!has(r, c + 1)) edges.push({ x1: c + 1, y1: r,     x2: c + 1, y2: r + 1 });
    if (!has(r + 1, c)) edges.push({ x1: c + 1, y1: r + 1, x2: c,     y2: r + 1 });
    if (!has(r, c - 1)) edges.push({ x1: c,     y1: r + 1, x2: c,     y2: r });
  }
  return edges;
}

function chainLoops(edges) {
  const id = (e) => `${e.x1},${e.y1},${e.x2},${e.y2}`;
  const byStart = new Map();
  for (const e of edges) {
    const k = `${e.x1},${e.y1}`;
    const arr = byStart.get(k);
    if (arr) arr.push(e); else byStart.set(k, [e]);
  }
  const used = new Set();
  const loops = [];
  for (const e0 of edges) {
    if (used.has(id(e0))) continue;
    const loop = [];
    let e = e0;
    while (e && !used.has(id(e))) {
      used.add(id(e));
      loop.push(e);
      e = (byStart.get(`${e.x2},${e.y2}`) ?? []).find((n) => !used.has(id(n)));
    }
    if (loop.length) loops.push(loop);
  }
  return loops;
}

function roundedPathFromLoop(loop, radius) {
  const n = loop.length;
  if (n === 0) return '';
  const verts = loop.map((e) => [e.x1, e.y1]);
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n], curr = verts[i], next = verts[(i + 1) % n];
    const inDx = Math.sign(curr[0] - prev[0]), inDy = Math.sign(curr[1] - prev[1]);
    const outDx = Math.sign(next[0] - curr[0]), outDy = Math.sign(next[1] - curr[1]);
    const edgeIn = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
    const edgeOut = Math.hypot(next[0] - curr[0], next[1] - curr[1]);
    const rad = Math.min(radius, edgeIn / 2 - 0.001, edgeOut / 2 - 0.001, 0.48);
    const p1 = [curr[0] - inDx * rad, curr[1] - inDy * rad];
    const p2 = [curr[0] + outDx * rad, curr[1] + outDy * rad];
    const cross = inDx * outDy - inDy * outDx;
    if (i === 0) d += cross > 0 ? `M ${p1[0]} ${p1[1]}` : `M ${curr[0]} ${curr[1]}`;
    else d += cross > 0 ? ` L ${p1[0]} ${p1[1]}` : ` L ${curr[0]} ${curr[1]}`;
    if (cross > 0) d += ` A ${rad} ${rad} 0 0 1 ${p2[0]} ${p2[1]}`;
  }
  return d + ' Z';
}

/** Rounded union of a polyomino. Multiple loops cover holes. */
export function unionPath(cells, radius = 0.18) {
  if (cells.length === 0) return '';
  return chainLoops(directedEdges(cells)).map((l) => roundedPathFromLoop(l, radius)).join(' ');
}

export function gridSegs(puzzle) {
  const segs = [];
  for (const [k, ri] of puzzle.cells) {
    const [r, c] = k.split(',').map(Number);
    const right = puzzle.cells.get(key(r, c + 1));
    if (right !== undefined) segs.push({ x1: c + 1, y1: r, x2: c + 1, y2: r + 1, same: right === ri });
    const down = puzzle.cells.get(key(r + 1, c));
    if (down !== undefined) segs.push({ x1: c, y1: r + 1, x2: c + 1, y2: r + 1, same: down === ri });
  }
  return segs;
}

/** Bottom-right corner of the south-easternmost cell — official badge seat. */
export function badgeAnchor(region) {
  const [r, c] = region.cells.slice().sort((a, b) => b[0] - a[0] || b[1] - a[1])[0];
  return { x: c + 1, y: r + 1 };
}

export function paintCells(cellRects, puzzle, assigned, statuses, anchor) {
  for (const [k, rect] of cellRects) {
    const ri = puzzle.cells.get(k);
    const sw = swatchFor(assigned, ri);
    const st = statuses[ri];
    const isAnchor = anchor && key(...anchor) === k;
    let fill = sw.fill;
    if (st === 'violated') fill = `color-mix(in oklab, #e8b0a8 55%, ${sw.fill})`;
    if (isAnchor) fill = `color-mix(in oklab, #e8c36a 50%, ${sw.fill})`;
    rect.setAttribute('fill', fill);
  }
}

// Static board layer: polyomino frame, region fills, grid, diamond badges.
// Returns { svg, cellRects, hitRects, tiles, assigned }.
export function boardSvg(puzzle) {
  const cells = [...puzzle.cells.keys()].map((k) => k.split(',').map(Number));
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const [r, c] of cells) {
    if (r < minR) minR = r; if (c < minC) minC = c;
    if (r > maxR) maxR = r; if (c > maxC) maxC = c;
  }
  const padL = .42, padT = .42, padR = .62, padB = .62;
  const svg = el('svg', {
    viewBox: `${minC - padL} ${minR - padT} ${maxC + 1 - minC + padL + padR} ${maxR + 1 - minR + padT + padB}`,
    class: 'board',
    role: 'img',
    'aria-label': 'Pips board',
  });
  const assigned = colorRegions(puzzle);
  const clipD = unionPath(cells, 0.16);
  const frameD = unionPath(cells, 0.2);
  const defs = el('defs', {}, el('clipPath', { id: 'board-clip' }, el('path', { d: clipD })));
  const fills = el('g', { 'clip-path': 'url(#board-clip)' });
  const tiles = el('g');
  const hits = el('g');
  const badges = el('g');
  svg.append(
    defs,
    el('path', { d: frameD, class: 'frame' }),
    fills, tiles, hits, badges,
  );

  const cellRects = new Map(), hitRects = new Map();
  for (const [k, ri] of puzzle.cells) {
    const [r, c] = k.split(',').map(Number);
    const sw = swatchFor(assigned, ri);
    const rect = el('rect', { x: c, y: r, width: 1, height: 1, fill: sw.fill, class: 'cell' });
    fills.append(rect); cellRects.set(k, rect);
    const hit = el('rect', { x: c, y: r, width: 1, height: 1, class: 'hit', 'data-cell': k });
    hits.append(hit); hitRects.set(k, hit);
  }
  for (const s of gridSegs(puzzle)) {
    fills.append(el('line', {
      x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
      class: s.same ? 'inner' : 'seam',
    }));
  }

  const taken = [];
  for (const [i, reg] of puzzle.regions.entries()) {
    const t = labelText(reg);
    if (!t) continue;
    const sw = swatchFor(assigned, i);
    let { x, y } = badgeAnchor(reg);
    let guard = 0;
    while (taken.some((p) => Math.hypot(p.x - x, p.y - y) < 0.42) && guard < 8) {
      x += 0.22; y += 0.08; guard++;
    }
    taken.push({ x, y });
    const s = Math.max(0.5, 0.34 + 0.09 * t.length);
    const g = el('g', { transform: `translate(${x},${y})`, class: 'badge' });
    g.append(el('rect', {
      x: -s / 2, y: -s / 2, width: s, height: s, rx: s * 0.16,
      transform: 'rotate(45)', fill: sw.badge, class: 'badge-diamond',
    }));
    g.append(el('text', {
      class: 'badge-text',
      'font-size': t.length > 2 ? '0.22' : '0.26',
    }, t));
    badges.append(g);
  }
  return { svg, cellRects, hitRects, tiles, assigned };
}

// Tray tile: horizontal 2x1 domino.
export function traySvg(a, b) {
  const svg = el('svg', { viewBox: '0 0 2 1' });
  svg.append(tile([0, 0], [0, 1], a, b));
  return svg;
}
