import type { RawPuzzle } from "./engine";
import type { CountResult } from "./puzzle-analysis-types";
import { countGeometricTilings, normalizePuzzle, type CounterLimits } from "./solution-count";

function log2BigInt(value: bigint) {
  const bits = value.toString(2);
  const significant = bits.slice(0, 53);
  return bits.length - significant.length + Math.log2(Number.parseInt(significant, 2));
}

const factorial = (value: number) => {
  let total = 1n;
  for (let current = 2; current <= value; current++) total *= BigInt(current);
  return total;
};

export function countUnconstrainedArrangements(
  raw: RawPuzzle,
  limits: CounterLimits = {},
): CountResult {
  const geometry = countGeometricTilings(raw, limits);
  if (geometry.status !== "exact") return geometry;
  try {
    const puzzle = normalizePuzzle(raw);
    const dominoes = raw.dominoes.length;
    const nonDoubles = raw.dominoes.filter(([left, right]) => left !== right).length;
    const duplicateDivisor = puzzle.types.reduce(
      (total, type) => total * factorial(type.count),
      1n,
    );
    const inventoryFactor = (factorial(dominoes) / duplicateDivisor) * 2n ** BigInt(nonDoubles);
    return { status: "exact", count: (BigInt(geometry.count) * inventoryFactor).toString() };
  } catch (error) {
    return { status: "invalid", reason: error instanceof Error ? error.message : "invalid puzzle" };
  }
}

/** Exact-count-only structural reduction of the unconstrained arrangement space. */
export function constraintInformationBits(winning: CountResult, unconstrained: CountResult) {
  if (winning.status !== "exact" || unconstrained.status !== "exact") return null;
  const solutions = BigInt(winning.count);
  const arrangements = BigInt(unconstrained.count);
  if (solutions <= 0n || arrangements <= 0n || solutions > arrangements) return null;
  return log2BigInt(arrangements) - log2BigInt(solutions);
}
