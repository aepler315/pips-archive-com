import {
  evaluate,
  hardViolated,
  parsePuzzle,
  place,
  remainderTileable,
  validPlacements,
  type GameState,
  type Puzzle,
} from "./engine";
import {
  boardFingerprint,
  buildOffer,
  buildTargetMove,
  canonicalPips,
  matchingUnusedTiles,
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
  if (hardViolated(puzzle, state) || !remainderTileable(puzzle, state)) return { status: "impossible" };

  const nodeBudget = limits.nodeBudget ?? DEFAULT_LIMITS.nodeBudget;
  const deadlineMs = limits.deadlineMs ?? DEFAULT_LIMITS.deadlineMs;
  const now = limits.now ?? Date.now;
  const started = now();
  let expanded = 0;
  let unknown: SearchOutcome | null = null;

  const open = state
    .map((placement, d) => (placement ? -1 : d))
    .filter((d) => d >= 0);

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
): HintSearchResponse {
  const found = findCompletion(puzzle, state, limits);
  if (found.status !== "found") {
    return { id: "", status: found.status, reason: found.status === "unknown" ? found.reason : undefined };
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
    const result = searchHint(puzzle, request.state, request.puzzleHash, {
      nodeBudget: request.nodeBudget,
      deadlineMs: request.deadlineMs,
    });
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
