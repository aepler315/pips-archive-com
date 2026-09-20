import type { Level } from "./engine";
export type AnchorRecord = { date: string; level: Level; first: number; solvedAt: string };
export type LevelBaseline = { anchor: AnchorRecord[]; cutoff: string; logExpectedMs: number };
export type PerformanceBaseline = {
  schemaVersion: 1;
  modelVersion: "level-anchor-v1";
  levels: Partial<Record<Level, LevelBaseline>>;
};
export type CompletionContext = AnchorRecord & { puzzleHash: string };
export type Analytics = {
  schemaVersion: 1;
  baseline: PerformanceBaseline;
  contexts: CompletionContext[];
};
