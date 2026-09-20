import type { Level } from "./engine";

export type CountResult =
  | { status: "exact"; count: string }
  | {
      status: "bounded";
      lowerBound: string;
      reason: "node-budget" | "time-budget" | "memory-budget";
    }
  | { status: "invalid"; reason: string };

export type PuzzleAnalysis = {
  schemaVersion: 1;
  puzzleHash: string;
  countingVersion: string;
  equivalenceVersion: "fixed-board-unlabeled-dominoes-v1";
  date: string;
  level: Level;
  winning: CountResult;
  unconstrained: CountResult;
  constraintInformationBits: number | null;
  structural: {
    status: "complete" | "bounded";
    solverVersion: string;
    seeds: number[];
    medianFirstSolutionNodes: number | null;
    rootForcedFraction: number | null;
    maxDecisionDepth: number | null;
    referenceVersion: string | null;
    percentile: number | null;
  } | null;
};
