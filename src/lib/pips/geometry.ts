import type { Cell, Puzzle, Region } from "./engine";

const key = (r: number, c: number) => `${r},${c}`;

type Edge = { x1: number; y1: number; x2: number; y2: number };
type Vert = [number, number];

export type Bounds = { minR: number; minC: number; maxR: number; maxC: number };

export const BOARD = {
  inset: 0.09,
  radius: 0.26,
  stroke: 0.058,
  innerStroke: 0.044,
  dash: "0.22 0.13",
  innerDash: "0.16 0.11",
  dividerPad: 0.14,
} as const;

export function boundsOf(cells: Iterable<Cell>): Bounds {
  let minR = Infinity,
    minC = Infinity,
    maxR = -Infinity,
    maxC = -Infinity;
  for (const [r, c] of cells) {
    if (r < minR) minR = r;
    if (c < minC) minC = c;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  return { minR, minC, maxR, maxC };
}

export function puzzleCells(puzzle: Puzzle): Cell[] {
  return [...puzzle.cells.keys()].map((k) => {
    const [r, c] = k.split(",").map(Number);
    return [r, c] as Cell;
  });
}

export function cellCentroid(cells: Iterable<Cell>): { x: number; y: number } {
  let x = 0,
    y = 0,
    n = 0;
  for (const [r, c] of cells) {
    x += c + 0.5;
    y += r + 0.5;
    n++;
  }
  return n ? { x: x / n, y: y / n } : { x: 0, y: 0 };
}

function directedEdges(cells: Cell[]): Edge[] {
  const set = new Set(cells.map(([r, c]) => key(r, c)));
  const has = (r: number, c: number) => set.has(key(r, c));
  const edges: Edge[] = [];
  for (const [r, c] of cells) {
    if (!has(r - 1, c)) edges.push({ x1: c, y1: r, x2: c + 1, y2: r });
    if (!has(r, c + 1)) edges.push({ x1: c + 1, y1: r, x2: c + 1, y2: r + 1 });
    if (!has(r + 1, c)) edges.push({ x1: c + 1, y1: r + 1, x2: c, y2: r + 1 });
    if (!has(r, c - 1)) edges.push({ x1: c, y1: r + 1, x2: c, y2: r });
  }
  return edges;
}

function chainLoops(edges: Edge[]): Edge[][] {
  const id = (e: Edge) => `${e.x1},${e.y1},${e.x2},${e.y2}`;
  const byStart = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = `${e.x1},${e.y1}`;
    const arr = byStart.get(k);
    if (arr) arr.push(e);
    else byStart.set(k, [e]);
  }
  const used = new Set<string>();
  const loops: Edge[][] = [];
  for (const e0 of edges) {
    if (used.has(id(e0))) continue;
    const loop: Edge[] = [];
    let e: Edge | undefined = e0;
    while (e && !used.has(id(e))) {
      used.add(id(e));
      loop.push(e);
      const nexts: Edge[] = byStart.get(`${e.x2},${e.y2}`) ?? [];
      e = nexts.find((n: Edge) => !used.has(id(n)));
    }
    if (loop.length) loops.push(loop);
  }
  return loops;
}

function loopVerts(loop: Edge[]): Vert[] {
  return loop.map((e) => [e.x1, e.y1]);
}

function signedArea(verts: Vert[]): number {
  let a = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = verts[i];
    const [x2, y2] = verts[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function offsetVerts(verts: Vert[], inset: number): Vert[] {
  const n = verts.length;
  if (n < 3 || inset === 0) return verts;
  const sign = signedArea(verts) >= 0 ? 1 : -1;
  const out: Vert[] = [];
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n];
    const curr = verts[i];
    const next = verts[(i + 1) % n];
    const inDx = Math.sign(curr[0] - prev[0]);
    const inDy = Math.sign(curr[1] - prev[1]);
    const outDx = Math.sign(next[0] - curr[0]);
    const outDy = Math.sign(next[1] - curr[1]);
    if (inDx === outDx && inDy === outDy) continue;
    const inNx = -inDy * sign;
    const inNy = inDx * sign;
    const outNx = -outDy * sign;
    const outNy = outDx * sign;
    out.push([curr[0] + inset * (inNx + outNx), curr[1] + inset * (inNy + outNy)]);
  }
  return out;
}

function roundedPathFromVerts(verts: Vert[], radius: number): string {
  const n = verts.length;
  if (n === 0) return "";
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n];
    const curr = verts[i];
    const next = verts[(i + 1) % n];
    const inDx = Math.sign(curr[0] - prev[0]);
    const inDy = Math.sign(curr[1] - prev[1]);
    const outDx = Math.sign(next[0] - curr[0]);
    const outDy = Math.sign(next[1] - curr[1]);
    const edgeIn = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
    const edgeOut = Math.hypot(next[0] - curr[0], next[1] - curr[1]);
    const rad = Math.min(radius, edgeIn / 2 - 0.001, edgeOut / 2 - 0.001, 0.48);
    const p1 = [curr[0] - inDx * rad, curr[1] - inDy * rad];
    const p2 = [curr[0] + outDx * rad, curr[1] + outDy * rad];
    const cross = inDx * outDy - inDy * outDx;
    if (i === 0) {
      if (cross > 0) d += `M ${p1[0]} ${p1[1]}`;
      else d += `M ${curr[0]} ${curr[1]}`;
    } else if (cross > 0) {
      d += ` L ${p1[0]} ${p1[1]}`;
    } else {
      d += ` L ${curr[0]} ${curr[1]}`;
    }
    if (cross > 0) d += ` A ${rad} ${rad} 0 0 1 ${p2[0]} ${p2[1]}`;
  }
  d += " Z";
  return d;
}

export function unionPath(cells: Cell[], radius = 0.18, inset = 0): string {
  if (cells.length === 0) return "";
  return chainLoops(directedEdges(cells))
    .map((l) => roundedPathFromVerts(offsetVerts(loopVerts(l), inset), radius))
    .join(" ");
}

export type Seg = { x1: number; y1: number; x2: number; y2: number };

export function regionDividers(cells: Cell[], inset: number, endPad: number): Seg[] {
  const set = new Set(cells.map(([r, c]) => key(r, c)));
  const has = (r: number, c: number) => set.has(key(r, c));
  const segs: Seg[] = [];
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

/** Bottom-right corner of the region's south-easternmost cell — NYT's placement. */
export function badgeAnchor(region: Region): { x: number; y: number } {
  let r = region.cells[0][0];
  let c = region.cells[0][1];
  for (const [rr, cc] of region.cells) {
    if (rr > r || (rr === r && cc > c)) {
      r = rr;
      c = cc;
    }
  }
  return { x: c + 1, y: r + 1 };
}

export function badgeCandidates(
  region: Region,
  _centroid?: { x: number; y: number },
): { x: number; y: number }[] {
  return [badgeAnchor(region)];
}

export const PIP_LAYOUT: Record<number, [number, number][]> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.28, 0.28],
    [0.5, 0.5],
    [0.72, 0.72],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.5, 0.5],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  6: [
    [0.28, 0.24],
    [0.72, 0.24],
    [0.28, 0.5],
    [0.72, 0.5],
    [0.28, 0.76],
    [0.72, 0.76],
  ],
};
