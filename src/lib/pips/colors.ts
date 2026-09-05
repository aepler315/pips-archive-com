import type { Cell, Puzzle } from "./engine";
import { key } from "./engine";

export type Swatch = {
  id: string;
  fill: string;
  dash: string;
  badge: string;
};

export const EMPTY_SWATCH: Swatch = {
  id: "empty",
  fill: "#F3EBDC",
  dash: "#C4B49A",
  badge: "#8A7D6C",
};

export const PALETTE: Swatch[] = [
  { id: "pink", fill: "#F6C4D6", dash: "#D24A86", badge: "#DC3A78" },
  { id: "violet", fill: "#D0B8EA", dash: "#8A55B8", badge: "#7A38B0" },
  { id: "teal", fill: "#B3D9D3", dash: "#3D8F88", badge: "#1A7A74" },
  { id: "peach", fill: "#F3C4A4", dash: "#D0703C", badge: "#C85A28" },
  { id: "slate", fill: "#B7C2D4", dash: "#5A6A88", badge: "#3A4A68" },
  { id: "navy", fill: "#7B8AAB", dash: "#3A4A70", badge: "#243458" },
  { id: "mint", fill: "#B4E0C6", dash: "#3D9A68", badge: "#2B8A55" },
  { id: "lemon", fill: "#E8DC96", dash: "#B49A28", badge: "#A08818" },
  { id: "sky", fill: "#A6D4EE", dash: "#3A86B4", badge: "#2478A8" },
  { id: "lilac", fill: "#D8BFE6", dash: "#8A5AA8", badge: "#7A4898" },
  { id: "coral", fill: "#F0B0AE", dash: "#C0504E", badge: "#B03C3C" },
  { id: "sage", fill: "#C5DCA8", dash: "#6A9440", badge: "#5A8430" },
];

function regionAdj(puzzle: Puzzle): number[][] {
  const adj: number[][] = puzzle.regions.map(() => []);
  const dirs: Cell[] = [
    [0, 1],
    [1, 0],
  ];
  for (const [k, ri] of puzzle.cells) {
    const [r, c] = k.split(",").map(Number);
    for (const [dr, dc] of dirs) {
      const nj = puzzle.cells.get(key(r + dr, c + dc));
      if (nj === undefined || nj === ri) continue;
      if (!adj[ri].includes(nj)) adj[ri].push(nj);
      if (!adj[nj].includes(ri)) adj[nj].push(ri);
    }
  }
  return adj;
}

export function colorRegions(puzzle: Puzzle): (Swatch | null)[] {
  const adj = regionAdj(puzzle);
  const assigned: (Swatch | null)[] = puzzle.regions.map(() => null);
  for (const reg of puzzle.regions) {
    if (reg.type === "empty") continue;
    const used = new Set(
      adj[reg.id].map((i) => assigned[i]?.id).filter((id): id is string => !!id),
    );
    assigned[reg.id] = PALETTE.find((s) => !used.has(s.id)) ?? PALETTE[reg.id % PALETTE.length];
  }
  return assigned;
}

export function swatchFor(assigned: (Swatch | null)[], regionIndex: number): Swatch {
  return assigned[regionIndex] ?? EMPTY_SWATCH;
}
