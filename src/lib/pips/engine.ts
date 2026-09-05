export const LEVELS = ["easy", "medium", "hard"] as const;
export type Level = (typeof LEVELS)[number];
export const MAX_PIP = 6;

export type Cell = [number, number];
export type RegionType = "sum" | "less" | "greater" | "equals" | "unequal" | "empty";
export type RegionStatus = "satisfied" | "violated" | "pending";

export type RawRegion = {
  indices: Cell[];
  type: RegionType;
  target?: number;
};

export type RawPuzzle = {
  id?: number;
  backendId?: string;
  constructors?: string;
  dominoes: [number, number][];
  regions: RawRegion[];
  solution?: [Cell, Cell][];
};

export type RawDay = {
  printDate: string;
  editor?: string;
  easy: RawPuzzle;
  medium: RawPuzzle;
  hard: RawPuzzle;
};

export type Region = {
  id: number;
  type: RegionType;
  target: number | null;
  cells: Cell[];
};

export type Puzzle = {
  rows: number;
  cols: number;
  cells: Map<string, number>;
  regions: Region[];
  dominoes: [number, number][];
  solution: [Cell, Cell][] | null;
  meta: { id?: number; backendId?: string; constructors?: string };
};

export type Placement = { cells: [Cell, Cell] } | null;
export type GameState = Placement[];

export const key = (r: number, c: number) => `${r},${c}`;
export const unkey = (k: string): Cell => {
  const [r, c] = k.split(",").map(Number);
  return [r, c];
};

export function parsePuzzle(raw: RawPuzzle): Puzzle {
  const cells = new Map<string, number>();
  let rows = 0;
  let cols = 0;
  const regions = raw.regions.map((reg, i) => {
    const rc = reg.indices.map(([r, c]) => {
      const k = key(r, c);
      if (cells.has(k)) throw new Error(`cell ${k} in two regions`);
      cells.set(k, i);
      rows = Math.max(rows, r + 1);
      cols = Math.max(cols, c + 1);
      return [r, c] as Cell;
    });
    return { id: i, type: reg.type, target: reg.target ?? null, cells: rc };
  });
  const dominoes = raw.dominoes.map(([a, b]) => [a, b] as [number, number]);
  if (dominoes.length * 2 !== cells.size) {
    throw new Error(`domino count ${dominoes.length} does not cover ${cells.size} cells`);
  }
  return {
    rows,
    cols,
    cells,
    regions,
    dominoes,
    solution: raw.solution ?? null,
    meta: { id: raw.id, backendId: raw.backendId, constructors: raw.constructors },
  };
}

export const emptyState = (puzzle: Puzzle): GameState => puzzle.dominoes.map(() => null);

export const adjacent = ([r1, c1]: Cell, [r2, c2]: Cell) =>
  Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;

const DIRS: Cell[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export function occupancy(puzzle: Puzzle, state: GameState) {
  const occ = new Map<string, { d: number; pip: number }>();
  state.forEach((p, d) => {
    if (!p) return;
    p.cells.forEach(([r, c], j) => occ.set(key(r, c), { d, pip: puzzle.dominoes[d][j] }));
  });
  return occ;
}

/**
 * Remaining empty cells can still be covered by whole dominos (perfect matching
 * on the grid). Odd or isolated leftovers would require splitting a tile.
 */
export function remainderTileable(puzzle: Puzzle, state: GameState): boolean {
  const occ = occupancy(puzzle, state);
  const empty: Cell[] = [];
  for (const k of puzzle.cells.keys()) {
    if (!occ.has(k)) empty.push(unkey(k));
  }
  if (empty.length % 2) return false;
  if (empty.length === 0) return true;
  const black: Cell[] = [];
  const white: Cell[] = [];
  for (const cell of empty) {
    ((cell[0] + cell[1]) % 2 === 0 ? black : white).push(cell);
  }
  if (black.length !== white.length) return false;
  const wIdx = new Map(white.map((c, i) => [key(...c), i]));
  const adj = black.map(([r, c]) => {
    const out: number[] = [];
    for (const [dr, dc] of DIRS) {
      const j = wIdx.get(key(r + dr, c + dc));
      if (j != null) out.push(j);
    }
    return out;
  });
  const mate = new Array<number>(white.length).fill(-1);
  const dfs = (i: number, seen: boolean[]): boolean => {
    for (const j of adj[i]) {
      if (seen[j]) continue;
      seen[j] = true;
      if (mate[j] === -1 || dfs(mate[j], seen)) {
        mate[j] = i;
        return true;
      }
    }
    return false;
  };
  for (let i = 0; i < black.length; i++) {
    if (!dfs(i, new Array(white.length).fill(false))) return false;
  }
  return true;
}

export function canPlace(puzzle: Puzzle, state: GameState, d: number, c1: Cell, c2: Cell) {
  if (state[d]) return false;
  if (!adjacent(c1, c2)) return false;
  const k1 = key(...c1),
    k2 = key(...c2);
  if (!puzzle.cells.has(k1) || !puzzle.cells.has(k2)) return false;
  const occ = occupancy(puzzle, state);
  return !occ.has(k1) && !occ.has(k2);
}

export function place(puzzle: Puzzle, state: GameState, d: number, c1: Cell, c2: Cell): GameState {
  if (!canPlace(puzzle, state, d, c1, c2)) return state;
  const next = state.slice();
  next[d] = { cells: [c1.slice() as Cell, c2.slice() as Cell] };
  return next;
}

/** Empty on-board neighbors a domino could occupy from `cell`. */
export function legalNeighbors(puzzle: Puzzle, state: GameState, d: number, cell: Cell): Cell[] {
  const out: Cell[] = [];
  for (const [dr, dc] of DIRS) {
    const n: Cell = [cell[0] + dr, cell[1] + dc];
    if (canPlace(puzzle, state, d, cell, n)) out.push(n);
  }
  return out;
}

const DIR_PREFER: Cell[] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

/** Pick the other cell for a click on `cell`. Prefers a fit that doesn't break a region. */
export function chooseOther(puzzle: Puzzle, state: GameState, d: number, cell: Cell): Cell | null {
  const n = legalNeighbors(puzzle, state, d, cell);
  if (n.length === 0) return null;
  if (n.length === 1) return n[0];
  const fits = n.filter((other) => {
    const next = placeHighOn(puzzle, state, d, cell, other);
    return next !== state && !hardViolated(puzzle, next);
  });
  const pool = fits.length > 0 ? fits : n;
  for (const [dr, dc] of DIR_PREFER) {
    const hit = pool.find(([r, c]) => r === cell[0] + dr && c === cell[1] + dc);
    if (hit) return hit;
  }
  return pool[0];
}

/** Place `d` on `clicked`–`other` with the larger pip on `clicked`. */
export function placeHighOn(
  puzzle: Puzzle,
  state: GameState,
  d: number,
  clicked: Cell,
  other: Cell,
): GameState {
  if (!canPlace(puzzle, state, d, clicked, other)) return state;
  const [a, b] = puzzle.dominoes[d];
  if (a >= b) return place(puzzle, state, d, clicked, other);
  return place(puzzle, state, d, other, clicked);
}

/** Place `d` on `clicked`–`other` with the smaller pip on `clicked`. */
export function placeLowOn(
  puzzle: Puzzle,
  state: GameState,
  d: number,
  clicked: Cell,
  other: Cell,
): GameState {
  if (!canPlace(puzzle, state, d, clicked, other)) return state;
  const [a, b] = puzzle.dominoes[d];
  if (a <= b) return place(puzzle, state, d, clicked, other);
  return place(puzzle, state, d, other, clicked);
}

/**
 * Larger pip on `clicked`, unless that immediately breaks a region and the
 * flipped orientation does not. Never refuses a geometrically legal pair.
 */
export function placeOnClick(
  puzzle: Puzzle,
  state: GameState,
  d: number,
  clicked: Cell,
  other: Cell,
): GameState {
  const high = placeHighOn(puzzle, state, d, clicked, other);
  if (high !== state && !hardViolated(puzzle, high)) return high;
  const low = placeLowOn(puzzle, state, d, clicked, other);
  if (low !== state && !hardViolated(puzzle, low)) return low;
  return high === state ? low : high;
}

/**
 * If clicking `cell` would auto-place `d` (unique neighbor, unique
 * constraint-legal neighbor, or completing an anchored pair), return that
 * next state. Otherwise null — click would only set/keep an anchor.
 */
export function snapPlacement(
  puzzle: Puzzle,
  state: GameState,
  d: number,
  cell: Cell,
  anchor: Cell | null,
): GameState | null {
  if (state[d]) return null;
  const [a, b] = puzzle.dominoes[d];
  const isDouble = a === b;
  const commit = (c1: Cell, c2: Cell) =>
    isDouble ? place(puzzle, state, d, c1, c2) : placeOnClick(puzzle, state, d, c1, c2);

  if (anchor) {
    if (key(...anchor) === key(...cell)) return null;
    if (adjacent(anchor, cell) && canPlace(puzzle, state, d, anchor, cell)) {
      const next = commit(anchor, cell);
      return next[d] ? next : null;
    }
    return null;
  }

  const n = legalNeighbors(puzzle, state, d, cell);
  if (n.length === 0) return null;
  let pick = n.length === 1 ? n[0] : null;
  if (!pick) {
    const fits = n.filter((other) => {
      const next = commit(cell, other);
      return !!next[d] && !hardViolated(puzzle, next) && remainderTileable(puzzle, next);
    });
    if (fits.length === 1) pick = fits[0];
  }
  if (!pick) return null;
  const next = commit(cell, pick);
  return next[d] ? next : null;
}

export function openPairs(puzzle: Puzzle, state: GameState, d: number): [Cell, Cell][] {
  if (state[d]) return [];
  const occ = occupancy(puzzle, state);
  const out: [Cell, Cell][] = [];
  for (const k of puzzle.cells.keys()) {
    if (occ.has(k)) continue;
    const a = unkey(k);
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ] as Cell[]) {
      const b: Cell = [a[0] + dr, a[1] + dc];
      if (!puzzle.cells.has(key(...b)) || occ.has(key(...b))) continue;
      out.push([a, b]);
    }
  }
  return out;
}

/** Place so the larger pip sits on `first` (the first-clicked cell). Doubles are unchanged. */
export function placeHighFirst(
  puzzle: Puzzle,
  state: GameState,
  d: number,
  first: Cell,
  second: Cell,
): GameState {
  return placeHighOn(puzzle, state, d, first, second);
}

/** Place so the smaller pip sits on `first`. */
export function placeLowFirst(
  puzzle: Puzzle,
  state: GameState,
  d: number,
  first: Cell,
  second: Cell,
): GameState {
  const [a, b] = puzzle.dominoes[d];
  return a >= b ? place(puzzle, state, d, second, first) : place(puzzle, state, d, first, second);
}

/** Overshoot / contradiction only — not "this can't finish as a unique solution". */
export function hardViolated(puzzle: Puzzle, state: GameState) {
  const occ = occupancy(puzzle, state);
  return puzzle.regions.some((reg) => evaluateRegion(puzzle, occ, reg, false) === "violated");
}

/**
 * Prefer `highOnFirst`. If that placement violates a region, flip.
 * Occupancy-illegal placements are left unchanged.
 */
export function placePreferValid(
  puzzle: Puzzle,
  state: GameState,
  d: number,
  first: Cell,
  second: Cell,
  highOnFirst = true,
): GameState {
  const preferred = highOnFirst
    ? placeHighFirst(puzzle, state, d, first, second)
    : placeLowFirst(puzzle, state, d, first, second);
  if (preferred !== state && !hardViolated(puzzle, preferred)) return preferred;
  const flipped = highOnFirst
    ? placeLowFirst(puzzle, state, d, first, second)
    : placeHighFirst(puzzle, state, d, first, second);
  if (flipped !== state && !hardViolated(puzzle, flipped)) return flipped;
  if (flipped !== state) return flipped;
  return preferred === state ? state : preferred;
}

/** True if `d` can occupy c1–c2 without immediately violating a region. */
export function placementOk(
  puzzle: Puzzle,
  state: GameState,
  d: number,
  c1: Cell,
  c2: Cell,
): boolean {
  if (!canPlace(puzzle, state, d, c1, c2)) return false;
  const next = place(puzzle, state, d, c1, c2);
  return !hardViolated(puzzle, next);
}

/** Occupancy-legal neighbors from `cell` whose oriented placement does not violate. */
export function validSeconds(
  puzzle: Puzzle,
  state: GameState,
  d: number,
  first: Cell,
  highOnFirst = true,
): Cell[] {
  return legalNeighbors(puzzle, state, d, first).filter((n) => {
    const next = highOnFirst
      ? placeHighFirst(puzzle, state, d, first, n)
      : placeLowFirst(puzzle, state, d, first, n);
    if (next === state) return false;
    return !hardViolated(puzzle, next);
  });
}

export function regionOf(puzzle: Puzzle, cell: Cell): Region | undefined {
  const k = key(...cell);
  return puzzle.regions.find((r) => r.cells.some((c) => key(...c) === k));
}

/** Prefer unconstrained neighbors when more than one hard-legal second cell exists. */
export function preferOpenSeconds(
  puzzle: Puzzle,
  state: GameState,
  d: number,
  first: Cell,
  highOnFirst = true,
): Cell[] {
  const opts = validSeconds(puzzle, state, d, first, highOnFirst);
  if (opts.length <= 1) return opts;
  const open = opts.filter((n) => {
    const reg = regionOf(puzzle, n);
    return !reg || reg.type === "empty";
  });
  return open.length === 1 ? open : opts;
}

/**
 * Every orientation that fits in an empty adjacent pair without violating.
 * Doubles are listed once per pair. Length 1 ⇒ the piece can snap.
 */
export function validPlacements(puzzle: Puzzle, state: GameState, d: number): [Cell, Cell][] {
  if (state[d]) return [];
  const occ = occupancy(puzzle, state);
  const [pa, pb] = puzzle.dominoes[d];
  const out: [Cell, Cell][] = [];
  for (const k of puzzle.cells.keys()) {
    if (occ.has(k)) continue;
    const a = unkey(k);
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ] as Cell[]) {
      const b: Cell = [a[0] + dr, a[1] + dc];
      if (!puzzle.cells.has(key(...b)) || occ.has(key(...b))) continue;
      if (placementOk(puzzle, state, d, a, b)) out.push([a, b]);
      if (pa !== pb && placementOk(puzzle, state, d, b, a)) out.push([b, a]);
    }
  }
  return out;
}

export function remove(state: GameState, d: number): GameState {
  const next = state.slice();
  next[d] = null;
  return next;
}

export function flip(state: GameState, d: number): GameState {
  if (!state[d]) return state;
  const next = state.slice();
  next[d] = { cells: [state[d]!.cells[1], state[d]!.cells[0]] };
  return next;
}

function rot90cw([dr, dc]: Cell): Cell {
  return [dc, -dr];
}
function rot90ccw([dr, dc]: Cell): Cell {
  return [-dc, dr];
}
function swing(pivot: Cell, other: Cell, rot: (v: Cell) => Cell): Cell {
  const [dr, dc] = rot([other[0] - pivot[0], other[1] - pivot[1]]);
  return [pivot[0] + dr, pivot[1] + dc];
}

/** 90° if a free on-board landing exists, otherwise 180° (swap the two halves). */
export function rotatePlaced(puzzle: Puzzle, state: GameState, d: number): GameState {
  const p = state[d];
  if (!p) return state;
  const [c1, c2] = p.cells;
  const lifted = remove(state, d);
  const tries: [Cell, Cell][] = [
    [c1, swing(c1, c2, rot90cw)],
    [c2, swing(c2, c1, rot90cw)],
    [c1, swing(c1, c2, rot90ccw)],
    [c2, swing(c2, c1, rot90ccw)],
  ];
  for (const [keep, moved] of tries) {
    if (!canPlace(puzzle, lifted, d, keep, moved)) continue;
    return key(...keep) === key(...c1)
      ? place(puzzle, lifted, d, keep, moved)
      : place(puzzle, lifted, d, moved, keep);
  }
  return flip(state, d);
}

export function evaluateRegion(
  puzzle: Puzzle,
  occ: Map<string, { d: number; pip: number }>,
  region: Region,
  lookahead = true,
): RegionStatus {
  const vals: number[] = [];
  let empties = 0;
  for (const [r, c] of region.cells) {
    const o = occ.get(key(r, c));
    if (o) vals.push(o.pip);
    else empties++;
  }
  const complete = empties === 0;
  const sum = vals.reduce((a, b) => a + b, 0);
  const t = region.target;
  switch (region.type) {
    case "empty":
      return complete ? "satisfied" : "pending";
    case "sum":
      if (t == null || sum > t) return "violated";
      if (lookahead && sum + empties * MAX_PIP < t) return "violated";
      return complete ? (sum === t ? "satisfied" : "violated") : "pending";
    case "less":
      if (t == null || sum >= t) return "violated";
      return complete ? "satisfied" : "pending";
    case "greater":
      if (t == null) return "violated";
      if (lookahead && sum + empties * MAX_PIP <= t) return "violated";
      return complete ? (sum > t ? "satisfied" : "violated") : "pending";
    case "equals":
      if (new Set(vals).size > 1) return "violated";
      return complete ? "satisfied" : "pending";
    case "unequal":
      if (new Set(vals).size < vals.length) return "violated";
      return complete ? "satisfied" : "pending";
    default:
      return "pending";
  }
}

export function evaluate(puzzle: Puzzle, state: GameState) {
  const occ = occupancy(puzzle, state);
  const regions = puzzle.regions.map((reg) => evaluateRegion(puzzle, occ, reg));
  const placed = state.filter(Boolean).length;
  const solved = placed === puzzle.dominoes.length && regions.every((s) => s === "satisfied");
  return { regions, solved, placed, total: puzzle.dominoes.length, occ };
}

export function labelText(reg: Region): string {
  switch (reg.type) {
    case "sum":
      return String(reg.target);
    case "less":
      return `<${reg.target}`;
    case "greater":
      return `>${reg.target}`;
    case "equals":
      return "=";
    case "unequal":
      return "≠";
    case "empty":
      return "";
  }
}
