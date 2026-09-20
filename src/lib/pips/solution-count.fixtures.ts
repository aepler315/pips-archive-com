import type { Cell, RawPuzzle } from "./engine";

export const oneEdge: Cell[] = [
  [0, 0],
  [0, 1],
];

export const square: Cell[] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

export const free = (dominoes: [number, number][], indices: Cell[]): RawPuzzle => ({
  dominoes,
  regions: [{ type: "empty", indices }],
});

/** Test-only placeholder, replaced by the independent reference oracle. */
const compareCells = ([ar, ac]: Cell, [br, bc]: Cell) => ar - br || ac - bc;
const cellKey = ([row, column]: Cell) => `${row},${column}`;
const edgeKey = (left: Cell, right: Cell) => {
  const [first, second] = compareCells(left, right) <= 0 ? [left, right] : [right, left];
  return `${cellKey(first)}-${cellKey(second)}`;
};
const adjacent = ([ar, ac]: Cell, [br, bc]: Cell) => Math.abs(ar - br) + Math.abs(ac - bc) === 1;

type Tiling = [Cell, Cell][];

function geometricTilings(cells: Cell[]): Tiling[] {
  const sorted = cells.slice().sort(compareCells);
  const playable = new Map(sorted.map((cell) => [cellKey(cell), cell]));
  const visit = (uncovered: Set<string>): Tiling[] => {
    if (uncovered.size === 0) return [[]];
    const first = sorted.find((cell) => uncovered.has(cellKey(cell)));
    if (!first) return [];
    const rest = new Set(uncovered);
    rest.delete(cellKey(first));
    const out: Tiling[] = [];
    for (const candidate of sorted) {
      if (
        !rest.has(cellKey(candidate)) ||
        !adjacent(first, candidate) ||
        !playable.has(cellKey(candidate))
      )
        continue;
      const next = new Set(rest);
      next.delete(cellKey(candidate));
      for (const tail of visit(next)) out.push([[first, candidate], ...tail]);
    }
    return out;
  };
  return visit(new Set(sorted.map(cellKey)));
}

function satisfiesRules(raw: RawPuzzle, values: Map<string, number>) {
  return raw.regions.every((region) => {
    const pips = region.indices.map((cell) => values.get(cellKey(cell)));
    if (pips.some((pip) => pip == null)) return false;
    const assigned = pips as number[];
    const sum = assigned.reduce((total, pip) => total + pip, 0);
    switch (region.type) {
      case "empty":
        return true;
      case "sum":
        return sum === region.target;
      case "less":
        return region.target != null && sum < region.target;
      case "greater":
        return region.target != null && sum > region.target;
      case "equals":
        return assigned.every((pip) => pip === assigned[0]);
      case "unequal":
        return new Set(assigned).size === assigned.length;
    }
  });
}

function canonicalArrangement(edges: Tiling, values: Map<string, number>) {
  return edges
    .map(([left, right]) => {
      const [first, second] = compareCells(left, right) <= 0 ? [left, right] : [right, left];
      return `${edgeKey(first, second)}:${values.get(cellKey(first))},${values.get(cellKey(second))}`;
    })
    .sort()
    .join("|");
}

/**
 * Deliberately simple test oracle: enumerate geometry first, then assign
 * normalized domino types and orientations. Production code must not import it.
 */
export function oracleCount(raw: RawPuzzle): bigint {
  const cells = raw.regions.flatMap((region) => region.indices);
  const tilings = geometricTilings(cells);
  const types = new Map<string, { pips: [number, number]; count: number }>();
  for (const [first, second] of raw.dominoes) {
    const pips: [number, number] = first <= second ? [first, second] : [second, first];
    const type = `${pips[0]}-${pips[1]}`;
    const found = types.get(type);
    if (found) found.count++;
    else types.set(type, { pips, count: 1 });
  }
  const remaining = [...types.values()].sort(
    (left, right) => left.pips[0] - right.pips[0] || left.pips[1] - right.pips[1],
  );
  const arrangements = new Set<string>();

  for (const tiling of tilings) {
    const values = new Map<string, number>();
    const assign = (index: number) => {
      if (index === tiling.length) {
        if (satisfiesRules(raw, values)) arrangements.add(canonicalArrangement(tiling, values));
        return;
      }
      const [left, right] = tiling[index];
      for (const tile of remaining) {
        if (tile.count === 0) continue;
        tile.count--;
        const orientations: [number, number][] =
          tile.pips[0] === tile.pips[1] ? [tile.pips] : [tile.pips, [tile.pips[1], tile.pips[0]]];
        for (const [leftPip, rightPip] of orientations) {
          values.set(cellKey(left), leftPip);
          values.set(cellKey(right), rightPip);
          assign(index + 1);
        }
        values.delete(cellKey(left));
        values.delete(cellKey(right));
        tile.count++;
      }
    };
    assign(0);
  }
  return BigInt(arrangements.size);
}
