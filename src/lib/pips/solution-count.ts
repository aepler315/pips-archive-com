import type { RawPuzzle } from "./engine";
import type { CountResult } from "./puzzle-analysis-types";

export type CounterLimits = {
  nodeBudget?: number;
  memoEntryBudget?: number;
  deadlineMs?: number;
  now?: () => number;
};

import { normalizePuzzle, type NormalizedPuzzle } from "./puzzle-content";
export { normalizePuzzle, hashPuzzle } from "./puzzle-content";
type Region = NormalizedPuzzle["regions"][number];
const DEFAULT_LIMITS: Required<Omit<CounterLimits, "now">> = {
  nodeBudget: 2_000_000,
  memoEntryBudget: 250_000,
  deadlineMs: 30_000,
};
type StopReason = Extract<CountResult, { status: "bounded" }>["reason"];
type Outcome = { complete: boolean; count: bigint };

class Budget {
  readonly limits: Required<Omit<CounterLimits, "now">> & { now: () => number };
  readonly started: number;
  expanded = 0;
  reason: StopReason | null = null;

  constructor(limits: CounterLimits) {
    this.limits = { ...DEFAULT_LIMITS, ...limits, now: limits.now ?? Date.now };
    this.started = this.limits.now();
  }

  consumeNode() {
    if (this.reason) return false;
    if (this.expanded >= this.limits.nodeBudget) this.reason = "node-budget";
    else if (this.limits.now() - this.started >= this.limits.deadlineMs)
      this.reason = "time-budget";
    if (this.reason) return false;
    this.expanded++;
    return true;
  }
}

function countResult(run: () => Outcome, budget: Budget): CountResult {
  const outcome = run();
  return outcome.complete && !budget.reason
    ? { status: "exact", count: outcome.count.toString() }
    : {
        status: "bounded",
        lowerBound: outcome.count.toString(),
        reason: budget.reason ?? "node-budget",
      };
}

function regionPossible(puzzle: NormalizedPuzzle, assigned: number[], region: Region) {
  const values = region.cells.map((cell) => assigned[cell]).filter((pip) => pip >= 0);
  const empty = region.cells.length - values.length;
  const sum = values.reduce((total, pip) => total + pip, 0);
  switch (region.type) {
    case "empty":
      return true;
    case "sum":
      return region.target != null && sum <= region.target && sum + empty * 6 >= region.target;
    case "less":
      return region.target != null && sum < region.target;
    case "greater":
      return region.target != null && sum + empty * 6 > region.target;
    case "equals":
      return new Set(values).size <= 1;
    case "unequal":
      return new Set(values).size === values.length;
  }
}

function allRulesSatisfied(puzzle: NormalizedPuzzle, assigned: number[]) {
  return puzzle.regions.every((region) => {
    if (!regionPossible(puzzle, assigned, region)) return false;
    const values = region.cells.map((cell) => assigned[cell]);
    const sum = values.reduce((total, pip) => total + pip, 0);
    switch (region.type) {
      case "empty":
        return true;
      case "sum":
        return sum === region.target;
      case "less":
        return sum < region.target!;
      case "greater":
        return sum > region.target!;
      case "equals":
      case "unequal":
        return true;
    }
  });
}

type Placement = { neighbor: number; type: number; first: number; second: number };

export function countWinningArrangements(raw: RawPuzzle, limits: CounterLimits = {}): CountResult {
  let puzzle: NormalizedPuzzle;
  try {
    puzzle = normalizePuzzle(raw);
  } catch (error) {
    return { status: "invalid", reason: error instanceof Error ? error.message : "invalid puzzle" };
  }
  const budget = new Budget(limits);
  const uncovered = new Array<boolean>(puzzle.cells.length).fill(true);
  const assigned = new Array<number>(puzzle.cells.length).fill(-1);
  const remaining = puzzle.types.map((type) => type.count);
  const memo = new Map<string, bigint>();

  const apply = (cell: number, placement: Placement) => {
    uncovered[cell] = false;
    uncovered[placement.neighbor] = false;
    assigned[cell] = placement.first;
    assigned[placement.neighbor] = placement.second;
    remaining[placement.type]--;
  };
  const undo = (cell: number, placement: Placement) => {
    uncovered[cell] = true;
    uncovered[placement.neighbor] = true;
    assigned[cell] = -1;
    assigned[placement.neighbor] = -1;
    remaining[placement.type]++;
  };
  const placements = (cell: number): Placement[] => {
    const candidates: Placement[] = [];
    for (const neighbor of puzzle.neighbors[cell]) {
      if (!uncovered[neighbor]) continue;
      for (let type = 0; type < puzzle.types.length; type++) {
        if (remaining[type] === 0) continue;
        const [low, high] = puzzle.types[type].pips;
        const orientations: [number, number][] =
          low === high
            ? [[low, high]]
            : [
                [low, high],
                [high, low],
              ];
        for (const [first, second] of orientations) {
          const placement = { neighbor, type, first, second };
          apply(cell, placement);
          const valid =
            regionPossible(puzzle, assigned, puzzle.regions[puzzle.regionForCell[cell]]) &&
            regionPossible(puzzle, assigned, puzzle.regions[puzzle.regionForCell[neighbor]]);
          undo(cell, placement);
          if (valid) candidates.push(placement);
        }
      }
    }
    return candidates;
  };
  const stateKey = () =>
    `${uncovered.map((value) => (value ? "1" : "0")).join("")}/${remaining.join(",")}/${assigned.join(",")}`;
  const visit = (): Outcome => {
    if (!budget.consumeNode()) return { complete: false, count: 0n };
    if (!uncovered.some(Boolean))
      return { complete: true, count: allRulesSatisfied(puzzle, assigned) ? 1n : 0n };
    const key = stateKey();
    const cached = memo.get(key);
    if (cached != null) return { complete: true, count: cached };
    if (memo.size >= budget.limits.memoEntryBudget) {
      budget.reason = "memory-budget";
      return { complete: false, count: 0n };
    }
    let chosen = -1;
    let choices: Placement[] = [];
    for (let cell = 0; cell < uncovered.length; cell++) {
      if (!uncovered[cell]) continue;
      const candidates = placements(cell);
      if (candidates.length === 0) return { complete: true, count: 0n };
      if (chosen < 0 || candidates.length < choices.length) {
        chosen = cell;
        choices = candidates;
      }
    }
    let total = 0n;
    for (const placement of choices) {
      apply(chosen, placement);
      const child = visit();
      undo(chosen, placement);
      total += child.count;
      if (!child.complete) return { complete: false, count: total };
    }
    memo.set(key, total);
    return { complete: true, count: total };
  };
  return countResult(visit, budget);
}

export function countGeometricTilings(raw: RawPuzzle, limits: CounterLimits = {}): CountResult {
  let puzzle: NormalizedPuzzle;
  try {
    puzzle = normalizePuzzle(raw);
  } catch (error) {
    return { status: "invalid", reason: error instanceof Error ? error.message : "invalid puzzle" };
  }
  const budget = new Budget(limits);
  const uncovered = new Array<boolean>(puzzle.cells.length).fill(true);
  const memo = new Map<string, bigint>();
  const visit = (): Outcome => {
    if (!budget.consumeNode()) return { complete: false, count: 0n };
    const chosen = uncovered.findIndex(Boolean);
    if (chosen < 0) return { complete: true, count: 1n };
    const key = uncovered.map((value) => (value ? "1" : "0")).join("");
    const cached = memo.get(key);
    if (cached != null) return { complete: true, count: cached };
    if (memo.size >= budget.limits.memoEntryBudget) {
      budget.reason = "memory-budget";
      return { complete: false, count: 0n };
    }
    let total = 0n;
    for (const neighbor of puzzle.neighbors[chosen]) {
      if (!uncovered[neighbor]) continue;
      uncovered[chosen] = false;
      uncovered[neighbor] = false;
      const child = visit();
      uncovered[chosen] = true;
      uncovered[neighbor] = true;
      total += child.count;
      if (!child.complete) return { complete: false, count: total };
    }
    memo.set(key, total);
    return { complete: true, count: total };
  };
  return countResult(visit, budget);
}
