import {
  evaluate,
  hardViolated,
  key,
  occupancy,
  parsePuzzle,
  place,
  remainderTileable,
  validPlacements,
  type Cell,
  type GameState,
  type Puzzle,
} from "./engine";
import {
  boardFingerprint,
  buildOffer,
  buildTargetMove,
  matchingUnusedTiles,
  orientedPlacement,
  pipsKey,
  witnessIsCompatible,
  type HintOffer,
  type HintSearchRequest,
  type HintSearchResponse,
} from "./hints";

export type HintSearchLimits = {
  nodeBudget?: number;
  deadlineMs?: number;
  now?: () => number;
};

const DEFAULT_LIMITS = { nodeBudget: 80_000, deadlineMs: 1_200 };

export type SearchOutcome =
  | { status: "found"; witness: GameState }
  | { status: "impossible" }
  | { status: "unknown"; reason: "node-budget" | "time-budget" | "invalid" };

export function findCompletion(
  puzzle: Puzzle,
  state: GameState,
  limits: HintSearchLimits = {},
): SearchOutcome {
  if (state.length !== puzzle.dominoes.length) return { status: "unknown", reason: "invalid" };
  if (evaluate(puzzle, state).solved) return { status: "found", witness: state };
  if (hardViolated(puzzle, state) || !remainderTileable(puzzle, state))
    return { status: "impossible" };

  const nodeBudget = limits.nodeBudget ?? DEFAULT_LIMITS.nodeBudget;
  const deadlineMs = limits.deadlineMs ?? DEFAULT_LIMITS.deadlineMs;
  const now = limits.now ?? Date.now;
  const started = now();
  let expanded = 0;
  let unknown: SearchOutcome | null = null;

  const open = state.map((placement, d) => (placement ? -1 : d)).filter((d) => d >= 0);

  const visit = (current: GameState, remaining: number[]): GameState | null => {
    if (unknown) return null;
    if (++expanded > nodeBudget) {
      unknown = { status: "unknown", reason: "node-budget" };
      return null;
    }
    if (now() - started >= deadlineMs) {
      unknown = { status: "unknown", reason: "time-budget" };
      return null;
    }
    if (!remaining.length) return evaluate(puzzle, current).solved ? current : null;
    if (hardViolated(puzzle, current) || !remainderTileable(puzzle, current)) return null;

    let bestIndex = 0;
    let bestOptions = validPlacements(puzzle, current, remaining[0]);
    for (let i = 1; i < remaining.length; i++) {
      const options = validPlacements(puzzle, current, remaining[i]);
      if (options.length < bestOptions.length) {
        bestIndex = i;
        bestOptions = options;
      }
      if (bestOptions.length === 0) break;
    }
    if (!bestOptions.length) return null;
    const d = remaining[bestIndex];
    const nextRemaining = remaining.filter((_, i) => i !== bestIndex);
    for (const [c1, c2] of bestOptions) {
      const placed = place(puzzle, current, d, c1, c2);
      if (placed === current) continue;
      const found = visit(placed, nextRemaining);
      if (found) return found;
      if (unknown) return null;
    }
    return null;
  };

  const witness = visit(state, open);
  if (witness) return { status: "found", witness };
  if (unknown) return unknown;
  return { status: "impossible" };
}

/**
 * Re-express a known solution as a completion of the player's board: every placed
 * domino must sit on one solution domino's exact cells with the same pips, and the
 * rest of the solution is dealt onto the player's unplaced dominoes of equal pips.
 */
export function alignWitness(
  puzzle: Puzzle,
  state: GameState,
  solution: [Cell, Cell][] | undefined,
): GameState | null {
  if (!solution || solution.length !== puzzle.dominoes.length) return null;
  if (state.length !== puzzle.dominoes.length) return null;
  const occ = occupancy(puzzle, state);
  const next = state.slice();
  const unplaced = state.flatMap((placement, d) => (placement ? [] : [d]));
  for (let i = 0; i < solution.length; i++) {
    const cells = solution[i];
    const [first, second] = puzzle.dominoes[i];
    const a = occ.get(key(...cells[0]));
    const b = occ.get(key(...cells[1]));
    if (a || b) {
      if (!a || !b || a.d !== b.d || a.pip !== first || b.pip !== second) return null;
      continue;
    }
    const at = unplaced.findIndex((d) => pipsKey(puzzle.dominoes[d]) === pipsKey([first, second]));
    if (at < 0) return null;
    const d = unplaced.splice(at, 1)[0];
    const oriented = orientedPlacement(puzzle.dominoes[d], cells, first);
    if (!oriented) return null;
    next[d] = { cells: oriented };
  }
  return !unplaced.length && evaluate(puzzle, next).solved ? next : null;
}

function targetFromWitness(puzzle: Puzzle, state: GameState, witness: GameState) {
  const candidates: NonNullable<ReturnType<typeof buildTargetMove>>[] = [];
  for (let d = 0; d < state.length; d++) {
    if (state[d] || !witness[d]) continue;
    const cells = witness[d]!.cells;
    const [firstPip, secondPip] = puzzle.dominoes[d];
    const target = buildTargetMove(puzzle, cells, firstPip, secondPip);
    if (target) candidates.push(target);
  }
  candidates.sort((a, b) => {
    const cellCmp =
      a.cells[0][0] - b.cells[0][0] ||
      a.cells[0][1] - b.cells[0][1] ||
      a.cells[1][0] - b.cells[1][0] ||
      a.cells[1][1] - b.cells[1][1];
    if (cellCmp) return cellCmp;
    return pipsKey(a.pips).localeCompare(pipsKey(b.pips)) || a.firstPip - b.firstPip;
  });
  return candidates[0] ?? null;
}

export function offerFromWitness(
  puzzle: Puzzle,
  state: GameState,
  witness: GameState,
  puzzleHash: string,
): HintOffer | null {
  if (!witnessIsCompatible(puzzle, state, witness)) return null;
  const target = targetFromWitness(puzzle, state, witness);
  if (!target) return null;
  if (!matchingUnusedTiles(puzzle, state, target.pips).length) return null;
  return buildOffer(puzzle, state, puzzleHash, target, 0);
}

export function searchHint(
  puzzle: Puzzle,
  state: GameState,
  puzzleHash: string,
  limits: HintSearchLimits = {},
  solution?: [Cell, Cell][],
): HintSearchResponse {
  // The published solution answers instantly whenever the board still agrees with
  // it; the bounded search only has to cover boards that took another road.
  const known = alignWitness(puzzle, state, solution);
  const found: SearchOutcome = known
    ? { status: "found", witness: known }
    : findCompletion(puzzle, state, limits);
  if (found.status !== "found") {
    return {
      id: "",
      status: found.status,
      reason: found.status === "unknown" ? found.reason : undefined,
    };
  }
  const offer = offerFromWitness(puzzle, state, found.witness, puzzleHash);
  if (!offer) {
    if (evaluate(puzzle, state).solved) return { id: "", status: "impossible" };
    return { id: "", status: "unknown", reason: "invalid" };
  }
  return { id: "", status: "found", offer, target: offer.target, witness: found.witness };
}

export function handleHintSearchRequest(request: HintSearchRequest): HintSearchResponse {
  try {
    const puzzle = parsePuzzle(request.raw);
    if (request.state.length !== puzzle.dominoes.length) {
      return { id: request.id, status: "unknown", reason: "invalid" };
    }
    const result = searchHint(
      puzzle,
      request.state,
      request.puzzleHash,
      { nodeBudget: request.nodeBudget, deadlineMs: request.deadlineMs },
      request.raw.solution,
    );
    if (result.status === "found") {
      if (result.offer.boardFingerprint !== boardFingerprint(puzzle, request.state)) {
        return { id: request.id, status: "unknown", reason: "invalid" };
      }
      return { ...result, id: request.id };
    }
    return { ...result, id: request.id };
  } catch {
    return { id: request.id, status: "unknown", reason: "invalid" };
  }
}
