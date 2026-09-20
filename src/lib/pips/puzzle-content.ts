import type { Cell, RawPuzzle, RegionType } from "./engine";
type TileType = { pips: [number, number]; count: number };
type Region = { type: RegionType; target: number | null; cells: number[] };
export type NormalizedPuzzle = {
  cells: Cell[];
  neighbors: number[][];
  regions: Region[];
  regionForCell: number[];
  types: TileType[];
};

const compareCells = ([ar, ac]: Cell, [br, bc]: Cell) => ar - br || ac - bc;
const cellKey = ([row, column]: Cell) => `${row},${column}`;
const allowedTypes = new Set<RegionType>(["sum", "less", "greater", "equals", "unequal", "empty"]);

function validCell(cell: Cell) {
  return (
    Array.isArray(cell) &&
    cell.length === 2 &&
    Number.isSafeInteger(cell[0]) &&
    Number.isSafeInteger(cell[1]) &&
    cell[0] >= 0 &&
    cell[1] >= 0
  );
}

export function normalizePuzzle(raw: RawPuzzle): NormalizedPuzzle {
  if (!raw || !Array.isArray(raw.dominoes) || !Array.isArray(raw.regions))
    throw new Error("puzzle must contain dominoes and regions");
  const cellsByKey = new Map<string, Cell>();
  const pendingRegions = raw.regions.map((region) => {
    if (!region || !allowedTypes.has(region.type) || !Array.isArray(region.indices))
      throw new Error("unsupported region rule");
    if (["sum", "less", "greater"].includes(region.type) && !Number.isSafeInteger(region.target)) {
      throw new Error(`${region.type} rule requires a safe integer target`);
    }
    return { type: region.type, target: region.target ?? null, rawCells: region.indices };
  });
  for (const region of pendingRegions) {
    for (const cell of region.rawCells) {
      if (!validCell(cell)) throw new Error("cell coordinates must be nonnegative safe integers");
      const key = cellKey(cell);
      if (cellsByKey.has(key)) throw new Error(`cell ${key} occurs in more than one region`);
      cellsByKey.set(key, [cell[0], cell[1]]);
    }
  }
  if (cellsByKey.size !== raw.dominoes.length * 2)
    throw new Error("cell count must equal twice the domino count");
  const cells = [...cellsByKey.values()].sort(compareCells);
  const indexByKey = new Map(cells.map((cell, index) => [cellKey(cell), index]));
  const regions = pendingRegions.map(({ type, target, rawCells }) => ({
    type,
    target,
    cells: rawCells.map((cell) => indexByKey.get(cellKey(cell))!),
  }));
  const regionForCell = new Array<number>(cells.length).fill(-1);
  regions.forEach((region, regionIndex) =>
    region.cells.forEach((cell) => (regionForCell[cell] = regionIndex)),
  );
  if (regionForCell.some((region) => region < 0))
    throw new Error("every playable cell must occur in one region");
  const neighbors = cells.map((cell, index) =>
    cells
      .map((other, otherIndex) => ({
        otherIndex,
        distance: Math.abs(cell[0] - other[0]) + Math.abs(cell[1] - other[1]),
      }))
      .filter(({ otherIndex, distance }) => otherIndex !== index && distance === 1)
      .map(({ otherIndex }) => otherIndex),
  );
  const typeCounts = new Map<string, TileType>();
  for (const domino of raw.dominoes) {
    if (
      !Array.isArray(domino) ||
      domino.length !== 2 ||
      !domino.every((pip) => Number.isInteger(pip) && pip >= 0 && pip <= 6)
    ) {
      throw new Error("domino pips must be integers from 0 through 6");
    }
    const pips: [number, number] =
      domino[0] <= domino[1] ? [domino[0], domino[1]] : [domino[1], domino[0]];
    const key = `${pips[0]}-${pips[1]}`;
    const type = typeCounts.get(key);
    if (type) type.count++;
    else typeCounts.set(key, { pips, count: 1 });
  }
  return {
    cells,
    neighbors,
    regions,
    regionForCell,
    types: [...typeCounts.values()].sort(
      (left, right) => left.pips[0] - right.pips[0] || left.pips[1] - right.pips[1],
    ),
  };
}

function canonicalContent(raw: RawPuzzle) {
  const puzzle = normalizePuzzle(raw);
  return JSON.stringify({
    cells: puzzle.cells,
    dominoes: puzzle.types.map((type) => [...type.pips, type.count]),
    regions: puzzle.regions
      .map((region) => ({
        type: region.type,
        target: region.target,
        cells: region.cells.map((cell) => puzzle.cells[cell]).sort(compareCells),
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  });
}

export async function hashPuzzle(raw: RawPuzzle) {
  const bytes = new TextEncoder().encode(canonicalContent(raw));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
