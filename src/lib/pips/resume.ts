import { adjacent, evaluate, key, type Cell, type GameState, type Puzzle } from "./engine";

const isCell = (v: unknown): v is Cell =>
  Array.isArray(v) &&
  v.length === 2 &&
  v.every((n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0);

/** The embedded solution, or null when it is missing or does not solve. */
export function stateFromSolution(puzzle: Puzzle): GameState | null {
  const sol = puzzle.solution;
  if (!sol || sol.length !== puzzle.dominoes.length) return null;
  const occupied = new Set<string>();
  const state: GameState = [];
  for (const pair of sol) {
    if (!pair || pair.length !== 2) return null;
    const [c1, c2] = pair;
    if (!isCell(c1) || !isCell(c2) || !adjacent(c1, c2)) return null;
    for (const cell of [c1, c2]) {
      const id = key(...cell);
      if (!puzzle.cells.has(id) || occupied.has(id)) return null;
      occupied.add(id);
    }
    state.push({
      cells: [
        [c1[0], c1[1]],
        [c2[0], c2[1]],
      ],
    });
  }
  return evaluate(puzzle, state).solved ? state : null;
}

/**
 * Board to show when a puzzle opens.
 * A placement already on the board wins, including a replay in progress.
 * A recorded solve with nothing placed uses the embedded solution, so a
 * completion from before boards were saved still opens finished.
 * `reviewing` is an already-recorded solve and must not be written again.
 */
export function resumeBoard(
  puzzle: Puzzle,
  progress: GameState | null,
  hasResult: boolean,
): { state: GameState; reviewing: boolean } | null {
  if (progress?.some(Boolean)) {
    return {
      state: progress,
      reviewing: hasResult && evaluate(puzzle, progress).solved,
    };
  }
  if (!hasResult) return null;
  const state = stateFromSolution(puzzle);
  return state ? { state, reviewing: true } : null;
}
