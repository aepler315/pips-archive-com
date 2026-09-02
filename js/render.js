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

const BOARD = {
  inset: 0.09, radius: 0.26, stroke: 0.058, innerStroke: 0.044,
  dash: '0.22 0.13', innerDash: '0.16 0.11', dividerPad: 0.14,
};

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

export function tile(c1, c2, a, b, cls = 'tile') {
  const [r1, col1] = c1, [r2, col2] = c2;
  const inset = .14;
  const x = Math.min(col1, col2) + inset, y = Math.min(r1, r2) + inset;
  const w = (col1 === col2 ? 1 : 2) - inset * 2, h = (r1 === r2 ? 1 : 2) - inset * 2;
  const g = el('g');
  g.append(el('rect', { x, y, width: w, height: h, rx: .18, class: cls }));
  const mx = (col1 + col2) / 2 + .5, my = (r1 + r2) / 2 + .5;
  g.append(col1 === col2
    ? el('line', { x1: x + .12, y1: my, x2: x + w - .12, y2: my, class: 'mid' })
    : el('line', { x1: mx, y1: y + .12, x2: mx, y2: y + h - .12, class: 'mid' }));
  g.append(pips(col1, r1, a), pips(col2, r2, b));
  return g;
}

export const labelText = (reg) => ({
  sum: String(reg.target), less: `<${reg.target}`, greater: `>${reg.target}`,
  equals: '=', unequal: '≠', empty: '',
})[reg.type];

const EMPTY_SWATCH = { id: 'empty', fill: '#F3EBDC', dash: '#C4B49A', badge: '#8A7D6C' };
const PALETTE = [
  { id: 'pink',   fill: '#F6C4D6', dash: '#D24A86', badge: '#DC3A78' },
  { id: 'violet', fill: '#D0B8EA', dash: '#8A55B8', badge: '#7A38B0' },
  { id: 'teal',   fill: '#B3D9D3', dash: '#3D8F88', badge: '#1A7A74' },
  { id: 'peach',  fill: '#F3C4A4', dash: '#D0703C', badge: '#C85A28' },
  { id: 'slate',  fill: '#B7C2D4', dash: '#5A6A88', badge: '#3A4A68' },
  { id: 'navy',   fill: '#7B8AAB', dash: '#3A4A70', badge: '#243458' },
  { id: 'mint',   fill: '#B4E0C6', dash: '#3D9A68', badge: '#2B8A55' },
  { id: 'lemon',  fill: '#E8DC96', dash: '#B49A28', badge: '#A08818' },
  { id: 'sky',    fill: '#A6D4EE', dash: '#3A86B4', badge: '#2478A8' },
  { id: 'lilac',  fill: '#D8BFE6', dash: '#8A5AA8', badge: '#7A4898' },
  { id: 'coral',  fill: '#F0B0AE', dash: '#C0504E', badge: '#B03C3C' },
  { id: 'sage',   fill: '#C5DCA8', dash: '#6A9440', badge: '#5A8430' },
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

function loopVerts(loop) { return loop.map((e) => [e.x1, e.y1]); }

function signedArea(verts) {
  let a = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i], [x2, y2] = verts[(i + 1) % verts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function offsetVerts(verts, inset) {
  const n = verts.length;
  if (n < 3 || inset === 0) return verts;
  const sign = signedArea(verts) >= 0 ? 1 : -1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n], curr = verts[i], next = verts[(i + 1) % n];
    const inDx = Math.sign(curr[0] - prev[0]), inDy = Math.sign(curr[1] - prev[1]);
    const outDx = Math.sign(next[0] - curr[0]), outDy = Math.sign(next[1] - curr[1]);
    if (inDx === outDx && inDy === outDy) continue;
    const inNx = -inDy * sign, inNy = inDx * sign;
    const outNx = -outDy * sign, outNy = outDx * sign;
    out.push([curr[0] + inset * (inNx + outNx), curr[1] + inset * (inNy + outNy)]);
  }
  return out;
}

function roundedPathFromVerts(verts, radius) {
  const n = verts.length;
  if (n === 0) return '';
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

export function unionPath(cells, radius = 0.18, inset = 0) {
  if (cells.length === 0) return '';
  return chainLoops(directedEdges(cells))
    .map((l) => roundedPathFromVerts(offsetVerts(loopVerts(l), inset), radius))
    .join(' ');
}

export function regionDividers(cells, inset, endPad) {
  const set = new Set(cells.map(([r, c]) => key(r, c)));
  const has = (r, c) => set.has(key(r, c));
  const segs = [];
  const pad = inset + endPad;
  for (const [r, c] of cells) {
    if (has(r, c + 1)) {
      const y0 = r + (has(r - 1, c) && has(r - 1, c + 1) ? endPad : pad);
      const y1 = r + 1 - (has(r + 1, c) && has(r + 1, c + 1) ? endPad : pad);
      if (y1 > y0) segs.push({ x1: c + 1, y1: y0, x2: c + 1, y2: y1 });
    }
    if (has(r + 1, c)) {
      const x0 = c + (has(r, c - 1) && has(r + 1, c - 1) ? endPad : pad);
      const x1 = c + 1 - (has(r, c + 1) && has(r + 1, c + 1) ? endPad : pad);
      if (x1 > x0) segs.push({ x1: x0, y1: r + 1, x2: x1, y2: r + 1 });
    }
  }
  return segs;
}

function cellCentroid(cells) {
  let x = 0, y = 0, n = 0;
  for (const [r, c] of cells) { x += c + 0.5; y += r + 0.5; n++; }
  return n ? { x: x / n, y: y / n } : { x: 0, y: 0 };
}

export function badgeCandidates(region, centroid) {
  const seen = new Set();
  const pts = [];
  for (const loop of chainLoops(directedEdges(region.cells))) {
    for (const [x, y] of loopVerts(loop)) {
      const id = `${x},${y}`;
      if (seen.has(id)) continue;
      seen.add(id);
      pts.push({ x, y, d: (x - centroid.x) ** 2 + (y - centroid.y) ** 2, tie: x + y });
    }
  }
  pts.sort((a, b) => a.d - b.d || b.tie - a.tie);
  return pts;
}

export function badgeAnchor(region, centroid) {
  if (!centroid) {
    const [r, c] = region.cells.slice().sort((a, b) => b[0] - a[0] || b[1] - a[1])[0];
    return { x: c + 1, y: r + 1 };
  }
  const c = badgeCandidates(region, centroid)[0];
  if (c) return { x: c.x, y: c.y };
  const [r, col] = region.cells.slice().sort((a, b) => b[0] - a[0] || b[1] - a[1])[0];
  return { x: col + 1, y: r + 1 };
}

export function paintRegions(regionPaths, puzzle, assigned, statuses, anchor) {
  for (const [i, path] of regionPaths) {
    const sw = swatchFor(assigned, i);
    const st = statuses[i];
    const isAnchor = anchor && puzzle.regions[i].cells.some((c) => key(...c) === key(...anchor));
    let fill = sw.fill;
    if (st === 'violated') fill = `color-mix(in oklab, #e8b0a8 45%, ${sw.fill})`;
    if (isAnchor) fill = `color-mix(in oklab, #e8c36a 40%, ${sw.fill})`;
    path.setAttribute('fill', fill);
  }
}

export function boardSvg(puzzle) {
  const cells = [...puzzle.cells.keys()].map((k) => k.split(',').map(Number));
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const [r, c] of cells) {
    if (r < minR) minR = r; if (c < minC) minC = c;
    if (r > maxR) maxR = r; if (c > maxC) maxC = c;
  }
  const pad = 0.55;
  const svg = el('svg', {
    viewBox: `${minC - pad} ${minR - pad} ${maxC + 1 - minC + pad * 2} ${maxR + 1 - minR + pad * 2}`,
    class: 'board', role: 'img', 'aria-label': 'Pips board',
  });
  const assigned = colorRegions(puzzle);
  const centroid = cellCentroid(cells);
  const defs = el('defs', {},
    el('filter', { id: 'region-shadow', x: '-15%', y: '-15%', width: '130%', height: '130%' },
      el('feDropShadow', { dx: '0', dy: '0.035', stdDeviation: '0.03', 'flood-opacity': '0.16' })),
    el('filter', { id: 'badge-shadow', x: '-25%', y: '-25%', width: '150%', height: '150%' },
      el('feDropShadow', { dx: '0', dy: '0.03', stdDeviation: '0.025', 'flood-opacity': '0.28' })),
  );
  const regionsG = el('g');
  const tiles = el('g');
  const hits = el('g');
  const badges = el('g');
  svg.append(defs, regionsG, tiles, hits, badges);

  const regionPaths = new Map();
  const hitRects = new Map();
  for (const [i, reg] of puzzle.regions.entries()) {
    const sw = swatchFor(assigned, i);
    const g = el('g', { filter: 'url(#region-shadow)' });
    const path = el('path', {
      d: unionPath(reg.cells, BOARD.radius, BOARD.inset),
      fill: sw.fill, stroke: sw.dash, 'stroke-width': BOARD.stroke,
      'stroke-dasharray': BOARD.dash, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    });
    g.append(path);
    regionPaths.set(i, path);
    for (const s of regionDividers(reg.cells, BOARD.inset, BOARD.dividerPad)) {
      g.append(el('line', {
        x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
        stroke: sw.dash, 'stroke-width': BOARD.innerStroke,
        'stroke-dasharray': BOARD.innerDash, 'stroke-linecap': 'round',
      }));
    }
    regionsG.append(g);
  }
  for (const [k] of puzzle.cells) {
    const [r, c] = k.split(',').map(Number);
    const hit = el('rect', { x: c, y: r, width: 1, height: 1, class: 'hit', 'data-cell': k });
    hits.append(hit); hitRects.set(k, hit);
  }

  const taken = [];
  for (const [i, reg] of puzzle.regions.entries()) {
    const t = labelText(reg);
    if (!t) continue;
    const sw = swatchFor(assigned, i);
    const cands = badgeCandidates(reg, centroid);
    let chosen = cands.find((c) => taken.every((p) => Math.hypot(p.x - c.x, p.y - c.y) >= 0.62));
    if (!chosen) {
      chosen = { ...(cands[0] ?? { x: 0, y: 0 }) };
      let guard = 0;
      while (taken.some((p) => Math.hypot(p.x - chosen.x, p.y - chosen.y) < 0.62) && guard < 8) {
        chosen.x += 0.22; chosen.y += 0.12; guard++;
      }
    }
    taken.push(chosen);
    const s = Math.max(0.56, 0.4 + 0.1 * t.length);
    const g = el('g', { transform: `translate(${chosen.x},${chosen.y})`, class: 'badge' });
    g.append(el('rect', {
      x: -s / 2, y: -s / 2, width: s, height: s, rx: s * 0.18,
      transform: 'rotate(45)', fill: sw.badge, class: 'badge-diamond', filter: 'url(#badge-shadow)',
    }));
    g.append(el('text', { class: 'badge-text', 'font-size': t.length > 2 ? '0.22' : '0.28' }, t));
    badges.append(g);
  }
  return { svg, hitRects, tiles, assigned, regionPaths };
}

export function traySvg(a, b) {
  const svg = el('svg', { viewBox: '0 0 2 1' });
  svg.append(tile([0, 0], [0, 1], a, b));
  return svg;
}
