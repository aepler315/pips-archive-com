import type { RawPuzzle } from "./engine";
import { normalizePuzzle, hashPuzzle } from "./puzzle-content";
import type { CounterLimits } from "./solution-count";
export type Trace = {
  seed: number;
  complete: boolean;
  found: boolean;
  nodes: number;
  decisions: number;
  backtracks: number;
  maxDecisionDepth: number;
  rootForcedFraction: number;
  reason: string | null;
};
// Independent empty-board first-solution traversal: no enumeration memo or answer input.
export async function profilePuzzle(raw: RawPuzzle, limits: CounterLimits = {}) {
  const hash = await hashPuzzle(raw);
  const seeds = Array.from({ length: 8 }, (_, i) => parseInt(hash.slice(i * 8, i * 8 + 8), 16));
  const traces = seeds.map((seed) => {
    const p = normalizePuzzle(raw);
    const values = p.cells.map(() => -1),
      remaining = p.types.map((t) => t.count);
    let random = seed || 1;
    const next = () => {
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      return (random >>> 0) / 4294967296;
    };
    const now = limits.now ?? Date.now,
      started = now();
    const trace: Trace = {
      seed,
      complete: true,
      found: false,
      nodes: 0,
      decisions: 0,
      backtracks: 0,
      maxDecisionDepth: 0,
      rootForcedFraction: 0,
      reason: null,
    };
    const possible = () =>
      p.regions.every((r) => {
        const vs = r.cells.map((c) => values[c]).filter((v) => v >= 0),
          missing = r.cells.length - vs.length,
          sum = vs.reduce((a, b) => a + b, 0);
        switch (r.type) {
          case "empty":
            return true;
          case "sum":
            return sum <= r.target! && sum + 6 * missing >= r.target!;
          case "less":
            return sum < r.target!;
          case "greater":
            return sum + 6 * missing > r.target!;
          case "equals":
            return new Set(vs).size <= 1;
          case "unequal":
            return new Set(vs).size === vs.length;
        }
      });
    type Choice = { cell: number; other: number; type: number; a: number; b: number };
    const candidates = (cell: number) => {
      const choices: Choice[] = [];
      for (const other of p.neighbors[cell])
        if (values[other] < 0) {
          p.types.forEach((t, type) => {
            if (!remaining[type]) return;
            const [a, b] = t.pips;
            for (const pair of a === b
              ? [[a, b]]
              : [
                  [a, b],
                  [b, a],
                ]) {
              values[cell] = pair[0];
              values[other] = pair[1];
              if (possible()) choices.push({ cell, other, type, a: pair[0], b: pair[1] });
              values[cell] = values[other] = -1;
            }
          });
        }
      return choices;
    };
    const visit = (depth: number, branching: boolean, forced: number): boolean => {
      if (
        trace.nodes >= (limits.nodeBudget ?? 2_000_000) ||
        now() - started >= (limits.deadlineMs ?? 30_000)
      ) {
        trace.complete = false;
        trace.reason =
          trace.nodes >= (limits.nodeBudget ?? 2_000_000) ? "node-budget" : "time-budget";
        return false;
      }
      trace.nodes++;
      if (values.every((v) => v >= 0)) {
        trace.rootForcedFraction = Math.max(
          trace.rootForcedFraction,
          forced / raw.dominoes.length || 0,
        );
        return possible();
      }
      let choices: Choice[] | null = null;
      for (let cell = 0; cell < values.length; cell++)
        if (values[cell] < 0) {
          const c = candidates(cell);
          if (!c.length) {
            trace.backtracks++;
            return false;
          }
          if (choices === null || c.length < choices.length) choices = c;
        }
      if (!choices) return false;
      const decision = choices.length > 1;
      if (decision) trace.decisions++;
      const nextDepth = depth + Number(decision);
      trace.maxDecisionDepth = Math.max(trace.maxDecisionDepth, nextDepth);
      if (!branching && !decision) {
        forced++;
        trace.rootForcedFraction = forced / raw.dominoes.length;
      }
      for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
      }
      for (const c of choices) {
        values[c.cell] = c.a;
        values[c.other] = c.b;
        remaining[c.type]--;
        const found = visit(nextDepth, branching || decision, forced);
        values[c.cell] = values[c.other] = -1;
        remaining[c.type]++;
        if (found) return true;
        if (!trace.complete) return false;
      }
      trace.backtracks++;
      return false;
    };
    trace.found = visit(0, false, 0);
    return trace;
  });
  const complete = traces.every((t) => t.complete && t.found);
  const nodes = traces.map((t) => t.nodes).sort((a, b) => a - b);
  return {
    status: complete ? ("complete" as const) : ("bounded" as const),
    solverVersion: "first-solution-v1",
    seeds,
    traces,
    medianFirstSolutionNodes: complete ? (nodes[3] + nodes[4]) / 2 : null,
    rootForcedFraction: complete ? traces.reduce((n, t) => n + t.rootForcedFraction, 0) / 8 : null,
    maxDecisionDepth: complete ? Math.max(...traces.map((t) => t.maxDecisionDepth)) : null,
    referenceVersion: null as string | null,
    percentile: null as number | null,
  };
}
