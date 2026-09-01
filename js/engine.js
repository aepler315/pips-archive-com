// Pips engine: pure logic, no DOM. Used by the browser UI and by the
// Node ingest/validation scripts.
//
// Raw NYT payload shape (one difficulty):
//   { id, backendId, constructors, dominoes: [[a,b],...],
//     regions: [{ indices: [[r,c],...], type, target? }, ...],
//     solution: [[[r,c],[r,c]], ...] }   // solution[i] holds dominoes[i]; first cell gets pip a
// Region types: sum | less | greater (compare region SUM to target), equals,
// unequal, empty (no constraint). The playable board is the union of region cells.

export const LEVELS = ['easy', 'medium', 'hard'];
export const MAX_PIP = 6;

export const key = (r, c) => `${r},${c}`;
export const unkey = (k) => k.split(',').map(Number);

export function parsePuzzle(raw) {
  const cells = new Map(); // key -> regionIndex
  let rows = 0, cols = 0;
  const regions = raw.regions.map((reg, i) => {
    const rc = reg.indices.map(([r, c]) => {
      const k = key(r, c);
      if (cells.has(k)) throw new Error(`cell ${k} in two regions`);
      cells.set(k, i);
      rows = Math.max(rows, r + 1);
      cols = Math.max(cols, c + 1);
      return [r, c];
    });
    return { id: i, type: reg.type, target: reg.target ?? null, cells: rc };
  });
  const dominoes = raw.dominoes.map(([a, b]) => [a, b]);
  if (dominoes.length * 2 !== cells.size) {
    throw new Error(`domino count ${dominoes.length} does not cover ${cells.size} cells`);
  }
  return { rows, cols, cells, regions, dominoes, solution: raw.solution ?? null,
           meta: { id: raw.id, backendId: raw.backendId, constructors: raw.constructors } };
}

// State is an array indexed by domino: null or { cells: [[r,c],[r,c]] }
// where cells[0] holds pip dominoes[i][0].
export const emptyState = (puzzle) => puzzle.dominoes.map(() => null);

export const adjacent = ([r1, c1], [r2, c2]) => Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;

export function occupancy(puzzle, state) {
  const occ = new Map(); // key -> { d: dominoIndex, pip }
  state.forEach((p, d) => {
    if (!p) return;
    p.cells.forEach(([r, c], j) => occ.set(key(r, c), { d, pip: puzzle.dominoes[d][j] }));
  });
  return occ;
}

export function canPlace(puzzle, state, d, c1, c2) {
  if (state[d]) return false;
  if (!adjacent(c1, c2)) return false;
  const k1 = key(...c1), k2 = key(...c2);
  if (!puzzle.cells.has(k1) || !puzzle.cells.has(k2)) return false;
  const occ = occupancy(puzzle, state);
  return !occ.has(k1) && !occ.has(k2);
}

export function place(puzzle, state, d, c1, c2) {
  if (!canPlace(puzzle, state, d, c1, c2)) return state;
  const next = state.slice();
  next[d] = { cells: [c1.slice(), c2.slice()] };
  return next;
}

export function remove(state, d) {
  const next = state.slice();
  next[d] = null;
  return next;
}

// Swap which end of the domino sits on which cell.
export function flip(state, d) {
  if (!state[d]) return state;
  const next = state.slice();
  next[d] = { cells: [state[d].cells[1], state[d].cells[0]] };
  return next;
}

// Returns 'satisfied' | 'violated' | 'pending'.
// 'satisfied' is only declared once the region is fully covered;
// 'violated' is declared as early as it becomes provably impossible.
export function evaluateRegion(puzzle, occ, region) {
  const vals = [];
  let empties = 0;
  for (const [r, c] of region.cells) {
    const o = occ.get(key(r, c));
    if (o) vals.push(o.pip); else empties++;
  }
  const complete = empties === 0;
  const sum = vals.reduce((a, b) => a + b, 0);
  const t = region.target;
  switch (region.type) {
    case 'empty':
      return complete ? 'satisfied' : 'pending';
    case 'sum':
      if (sum > t || sum + empties * MAX_PIP < t) return 'violated';
      return complete ? (sum === t ? 'satisfied' : 'violated') : 'pending';
    case 'less':
      if (sum >= t) return 'violated';
      return complete ? 'satisfied' : 'pending';
    case 'greater':
      if (sum + empties * MAX_PIP <= t) return 'violated';
      return complete ? (sum > t ? 'satisfied' : 'violated') : 'pending';
    case 'equals':
      if (new Set(vals).size > 1) return 'violated';
      return complete ? 'satisfied' : 'pending';
    case 'unequal':
      if (new Set(vals).size < vals.length) return 'violated';
      return complete ? 'satisfied' : 'pending';
    default:
      throw new Error(`unknown region type ${region.type}`);
  }
}

export function evaluate(puzzle, state) {
  const occ = occupancy(puzzle, state);
  const regions = puzzle.regions.map((reg) => evaluateRegion(puzzle, occ, reg));
  const placed = state.filter(Boolean).length;
  const solved = placed === puzzle.dominoes.length && regions.every((s) => s === 'satisfied');
  return { regions, solved, placed, total: puzzle.dominoes.length, occ };
}

// Build a state from the NYT-embedded solution (for validation/testing).
export function stateFromSolution(puzzle) {
  if (!puzzle.solution) throw new Error('no embedded solution');
  return puzzle.solution.map(([c1, c2]) => ({ cells: [c1.slice(), c2.slice()] }));
}

// Validate a full daily payload; returns list of problems (empty = ok).
export function validatePayload(raw) {
  const problems = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw?.printDate ?? '')) problems.push('bad printDate');
  for (const lvl of LEVELS) {
    if (!raw?.[lvl]) { problems.push(`missing ${lvl}`); continue; }
    try {
      const p = parsePuzzle(raw[lvl]);
      const st = stateFromSolution(p);
      st.forEach((pl, d) => {
        if (!pl || !adjacent(...pl.cells)) problems.push(`${lvl}: solution domino ${d} not adjacent`);
      });
      const ev = evaluate(p, st);
      if (!ev.solved) {
        const bad = ev.regions.map((s, i) => (s === 'satisfied' ? null : `${i}:${s}`)).filter(Boolean);
        problems.push(`${lvl}: embedded solution does not solve (${bad.join(' ')})`);
      }
    } catch (e) {
      problems.push(`${lvl}: ${e.message}`);
    }
  }
  return problems;
}

// Lightweight descriptor used by the archive index.
export function describe(raw, lvl) {
  const p = parsePuzzle(raw[lvl]);
  return {
    rows: p.rows, cols: p.cols, cells: p.cells.size, dominoes: p.dominoes.length,
    regions: p.regions.length, constructors: raw[lvl].constructors ?? null,
  };
}
