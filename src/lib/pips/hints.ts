import {
  adjacent,
  evaluate,
  key,
  occupancy,
  type Cell,
  type GameState,
  type Puzzle,
} from "./engine";

export const HINT_POLICY_VERSION = 1 as const;
export const HINT_SHEET_TITLE = "Need a pip?";
export const HINT_UNAVAILABLE_MESSAGE = "No hint is available for this board right now.";
export const HINT_NUDGE_MESSAGE = "Look at the outlined region.";

export type HintTier = 1 | 2 | 3;
export const HINT_TIERS: HintTier[] = [1, 2, 3];

/** Millisecond prices: 15s / 60s / 240s. */
export const HINT_PRICES_MS = { 1: 15_000, 2: 60_000, 3: 240_000 } as const;

export const HINT_TIER_COPY: Record<
  HintTier,
  { name: string; description: string; priceLabel: string; pips: number }
> = {
  1: {
    name: "Nudge",
    description: "Highlight a useful region associated with one valid next move.",
    priceLabel: "+00:15",
    pips: 1,
  },
  2: {
    name: "Pick a domino",
    description: "Highlight a usable domino and its associated region.",
    priceLabel: "+01:00",
    pips: 2,
  },
  3: {
    name: "Place a domino",
    description: "Place that domino into its verified cells with the correct orientation.",
    priceLabel: "+04:00",
    pips: 3,
  },
};

export type HintReceipt = {
  idempotencyKey: string;
  offerId: string;
  unlockedTier: HintTier;
  chargedMs: number;
  policyVersion: typeof HINT_POLICY_VERSION;
};

export type AssistanceMove = { offerId: string; highestTier: HintTier };

export type AssistanceSnapshot = {
  policyVersion: typeof HINT_POLICY_VERSION;
  penaltyMs: number;
  receipts: HintReceipt[];
  moves: AssistanceMove[];
};

export type HintTargetMove = {
  /** Canonical low-high pip pair. */
  pips: [number, number];
  /** Exact cells in witness orientation (cell 0 receives the chosen tile's first pip). */
  cells: [Cell, Cell];
  /** Pip that belongs on cells[0] in the witness. */
  firstPip: number;
  regionId: number;
  regionCells: Cell[];
};

export type HintOffer = {
  id: string;
  puzzleHash: string;
  boardFingerprint: string;
  target: HintTargetMove;
  highestTier: 0 | HintTier;
};

export type PurchasedOffer = HintOffer & { highestTier: HintTier };

export function isHintTier(value: unknown): value is HintTier {
  return value === 1 || value === 2 || value === 3;
}

export function priceMs(tier: HintTier): number {
  return HINT_PRICES_MS[tier];
}

export function priceSeconds(tier: HintTier): number {
  return priceMs(tier) / 1000;
}

export function upgradeChargeMs(from: 0 | HintTier, to: HintTier): number {
  if (to <= from) return 0;
  return priceMs(to) - (from === 0 ? 0 : priceMs(from));
}

export function scoredResultMs(elapsedMs: number, penaltyMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || !Number.isFinite(penaltyMs) || penaltyMs < 0) {
    throw new Error("Invalid duration");
  }
  return elapsedMs + penaltyMs;
}

export function formatHintDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) throw new Error("Invalid duration");
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function visibleUpgradePrice(from: 0 | HintTier, to: HintTier): string {
  const extra = upgradeChargeMs(from, to);
  return extra === 0 ? "Free" : `+${formatHintDuration(extra)}`;
}

export function receiptIdempotencyKey(offerId: string, tier: HintTier): string {
  return `${offerId}:${tier}`;
}

export function penaltyFromReceipts(receipts: HintReceipt[]): number {
  return receipts.reduce((sum, receipt) => sum + receipt.chargedMs, 0);
}

export function highestTiersByOffer(receipts: HintReceipt[]): AssistanceMove[] {
  const highest = new Map<string, HintTier>();
  for (const receipt of receipts) {
    const prev = highest.get(receipt.offerId) ?? 0;
    if (receipt.unlockedTier > prev) highest.set(receipt.offerId, receipt.unlockedTier);
  }
  return [...highest.entries()]
    .map(([offerId, highestTier]) => ({ offerId, highestTier }))
    .sort((a, b) => a.offerId.localeCompare(b.offerId));
}

export function freezeAssistance(receipts: HintReceipt[]): AssistanceSnapshot {
  const normalized = normalizeReceipts(receipts);
  if (!normalized) throw new Error("Invalid hint receipts");
  return {
    policyVersion: HINT_POLICY_VERSION,
    penaltyMs: penaltyFromReceipts(normalized),
    receipts: normalized,
    moves: highestTiersByOffer(normalized),
  };
}

export function assistancePenaltyMs(snapshot: AssistanceSnapshot | null | undefined): number {
  return snapshot && snapshot.policyVersion === HINT_POLICY_VERSION && snapshot.penaltyMs >= 0
    ? snapshot.penaltyMs
    : 0;
}

export function isAssistedSnapshot(snapshot: AssistanceSnapshot | null | undefined): boolean {
  return assistancePenaltyMs(snapshot) > 0;
}

export function resultsBreakdown(snapshot: AssistanceSnapshot | null | undefined): {
  offerId: string;
  highestTier: HintTier;
  costMs: number;
}[] {
  if (!snapshot) return [];
  return snapshot.moves.map((move) => ({
    ...move,
    costMs: priceMs(move.highestTier),
  }));
}

function isSafeCell(value: unknown): value is Cell {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isSafeInteger(value[0]) &&
    Number.isSafeInteger(value[1]) &&
    value[0] >= 0 &&
    value[1] >= 0
  );
}

function isHexHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function canonicalPips(pips: [number, number]): [number, number] {
  return pips[0] <= pips[1] ? [pips[0], pips[1]] : [pips[1], pips[0]];
}

export function pipsKey(pips: [number, number]): string {
  const [a, b] = canonicalPips(pips);
  return `${a}-${b}`;
}

export function compareCells(a: Cell, b: Cell): number {
  return a[0] - b[0] || a[1] - b[1];
}

export function boardFingerprint(puzzle: Puzzle, state: GameState): string {
  const occ = occupancy(puzzle, state);
  return [...occ.entries()]
    .map(([cell, { pip }]) => `${cell}:${pip}`)
    .sort()
    .join("|");
}

export function offerIdFor(
  puzzleHash: string,
  boardFp: string,
  target: Pick<HintTargetMove, "pips" | "cells" | "firstPip" | "regionId">,
): string {
  const [a, b] = canonicalPips(target.pips);
  const cells = target.cells
    .map((cell) => `${cell[0]},${cell[1]}`)
    .sort()
    .join("-");
  return `h${HINT_POLICY_VERSION}:${puzzleHash}:${boardFp || "empty"}:${a}-${b}:${target.firstPip}:${target.regionId}:${cells}`;
}

export function matchingUnusedTiles(
  puzzle: Puzzle,
  state: GameState,
  pips: [number, number],
): number[] {
  const want = pipsKey(pips);
  return puzzle.dominoes.flatMap((tile, index) =>
    !state[index] && pipsKey(tile) === want ? [index] : [],
  );
}

export function orientedPlacement(
  tile: [number, number],
  cells: [Cell, Cell],
  firstPip: number,
): [Cell, Cell] | null {
  if (tile[0] === firstPip) return [cells[0], cells[1]];
  if (tile[1] === firstPip) return [cells[1], cells[0]];
  return null;
}

export function placementForOffer(
  puzzle: Puzzle,
  state: GameState,
  offer: HintOffer,
): { d: number; cells: [Cell, Cell] } | null {
  const unused = matchingUnusedTiles(puzzle, state, offer.target.pips);
  if (!unused.length) return null;
  const d = unused[0];
  const cells = orientedPlacement(puzzle.dominoes[d], offer.target.cells, offer.target.firstPip);
  return cells ? { d, cells } : null;
}

export function offerStillApplies(puzzle: Puzzle, state: GameState, offer: HintOffer): boolean {
  const occ = occupancy(puzzle, state);
  if (occ.has(key(...offer.target.cells[0])) || occ.has(key(...offer.target.cells[1]))) return false;
  if (!adjacent(offer.target.cells[0], offer.target.cells[1])) return false;
  if (
    !puzzle.cells.has(key(...offer.target.cells[0])) ||
    !puzzle.cells.has(key(...offer.target.cells[1]))
  )
    return false;
  return placementForOffer(puzzle, state, offer) !== null;
}

export function chooseHintRegion(
  puzzle: Puzzle,
  cells: [Cell, Cell],
): {
  regionId: number;
  regionCells: Cell[];
} | null {
  const regions = cells
    .map((cell) => puzzle.regions[puzzle.cells.get(key(...cell)) ?? -1])
    .filter((region): region is Puzzle["regions"][number] => !!region);
  if (!regions.length) return null;
  const unique = [...new Map(regions.map((region) => [region.id, region])).values()];
  unique.sort((a, b) => {
    const rank = (region: Puzzle["regions"][number]) => (region.type === "empty" ? 1 : 0);
    return rank(a) - rank(b) || a.cells.length - b.cells.length || a.id - b.id;
  });
  const region = unique[0];
  return {
    regionId: region.id,
    regionCells: region.cells.map((cell) => [cell[0], cell[1]] as Cell),
  };
}

export function buildTargetMove(
  puzzle: Puzzle,
  cells: [Cell, Cell],
  firstPip: number,
  secondPip: number,
): HintTargetMove | null {
  const region = chooseHintRegion(puzzle, cells);
  if (!region) return null;
  return {
    pips: canonicalPips([firstPip, secondPip]),
    cells: [
      [cells[0][0], cells[0][1]],
      [cells[1][0], cells[1][1]],
    ],
    firstPip,
    regionId: region.regionId,
    regionCells: region.regionCells,
  };
}

export function buildOffer(
  puzzle: Puzzle,
  state: GameState,
  puzzleHash: string,
  target: HintTargetMove,
  highestTier: 0 | HintTier = 0,
): HintOffer {
  const boardFp = boardFingerprint(puzzle, state);
  return {
    id: offerIdFor(puzzleHash, boardFp, target),
    puzzleHash,
    boardFingerprint: boardFp,
    target,
    highestTier,
  };
}

export function findPurchasedOffer(
  offers: PurchasedOffer[] | undefined,
  boardFp: string,
): PurchasedOffer | undefined {
  return offers?.find((offer) => offer.boardFingerprint === boardFp);
}

export type PurchasePlan =
  | { status: "free"; tier: HintTier; chargedMs: 0; offer: HintOffer }
  | { status: "charge"; tier: HintTier; chargedMs: number; offer: HintOffer; receipt: HintReceipt }
  | { status: "downgrade" }
  | { status: "stale" };

export function planPurchase(
  puzzle: Puzzle,
  state: GameState,
  offer: HintOffer,
  toTier: HintTier,
  receipts: HintReceipt[] = [],
): PurchasePlan {
  if (!offerStillApplies(puzzle, state, offer)) return { status: "stale" };
  if (toTier < offer.highestTier) return { status: "downgrade" };
  const keyForTier = receiptIdempotencyKey(offer.id, toTier);
  const already = receipts.find((receipt) => receipt.idempotencyKey === keyForTier);
  if (already || toTier === offer.highestTier) {
    return { status: "free", tier: toTier, chargedMs: 0, offer: { ...offer, highestTier: toTier } };
  }
  const chargedMs = upgradeChargeMs(offer.highestTier, toTier);
  return {
    status: "charge",
    tier: toTier,
    chargedMs,
    offer: { ...offer, highestTier: toTier },
    receipt: {
      idempotencyKey: keyForTier,
      offerId: offer.id,
      unlockedTier: toTier,
      chargedMs,
      policyVersion: HINT_POLICY_VERSION,
    },
  };
}

export function applyReceipt(receipts: HintReceipt[], receipt: HintReceipt): HintReceipt[] | null {
  if (!isValidReceipt(receipt)) return null;
  if (receipts.some((existing) => existing.idempotencyKey === receipt.idempotencyKey)) {
    return receipts.map((existing) => ({ ...existing }));
  }
  return normalizeReceipts([...receipts, receipt]);
}

export function isValidReceipt(value: unknown): value is HintReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as HintReceipt;
  return (
    typeof receipt.idempotencyKey === "string" &&
    receipt.idempotencyKey.length > 0 &&
    typeof receipt.offerId === "string" &&
    receipt.offerId.length > 0 &&
    isHintTier(receipt.unlockedTier) &&
    receipt.policyVersion === HINT_POLICY_VERSION &&
    Number.isSafeInteger(receipt.chargedMs) &&
    receipt.chargedMs >= 0 &&
    receipt.idempotencyKey === receiptIdempotencyKey(receipt.offerId, receipt.unlockedTier) &&
    receipt.chargedMs <= priceMs(receipt.unlockedTier)
  );
}

export function normalizeReceipts(value: unknown): HintReceipt[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const receipts: HintReceipt[] = [];
  const highest = new Map<string, HintTier>();
  for (const item of value) {
    if (!isValidReceipt(item)) return null;
    if (seen.has(item.idempotencyKey)) return null;
    seen.add(item.idempotencyKey);
    const prev = highest.get(item.offerId) ?? 0;
    if (item.unlockedTier < prev) return null;
    highest.set(item.offerId, item.unlockedTier);
    receipts.push({
      idempotencyKey: item.idempotencyKey,
      offerId: item.offerId,
      unlockedTier: item.unlockedTier,
      chargedMs: item.chargedMs,
      policyVersion: HINT_POLICY_VERSION,
    });
  }
  const chargedByOffer = new Map<string, number>();
  for (const receipt of receipts) {
    chargedByOffer.set(
      receipt.offerId,
      (chargedByOffer.get(receipt.offerId) ?? 0) + receipt.chargedMs,
    );
  }
  for (const [offerId, charged] of chargedByOffer) {
    const top = highest.get(offerId);
    if (!top || charged !== priceMs(top)) return null;
  }
  return receipts;
}

export function normalizeAssistance(value: unknown): AssistanceSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as AssistanceSnapshot;
  if (raw.policyVersion !== HINT_POLICY_VERSION) return null;
  const receipts = normalizeReceipts(raw.receipts);
  if (!receipts) return null;
  const penaltyMs = penaltyFromReceipts(receipts);
  if (!Number.isSafeInteger(raw.penaltyMs) || raw.penaltyMs !== penaltyMs) return null;
  const moves = highestTiersByOffer(receipts);
  if (!Array.isArray(raw.moves) || raw.moves.length !== moves.length) return null;
  for (let i = 0; i < moves.length; i++) {
    const move = raw.moves[i];
    if (!move || move.offerId !== moves[i].offerId || move.highestTier !== moves[i].highestTier) {
      return null;
    }
  }
  return { policyVersion: HINT_POLICY_VERSION, penaltyMs, receipts, moves };
}

export function isValidPurchasedOffer(value: unknown): value is PurchasedOffer {
  if (!value || typeof value !== "object") return false;
  const offer = value as PurchasedOffer;
  return (
    typeof offer.id === "string" &&
    offer.id.length > 0 &&
    isHexHash(offer.puzzleHash) &&
    typeof offer.boardFingerprint === "string" &&
    isHintTier(offer.highestTier) &&
    isValidTarget(offer.target) &&
    offer.id === offerIdFor(offer.puzzleHash, offer.boardFingerprint, offer.target)
  );
}

function isValidTarget(value: unknown): value is HintTargetMove {
  if (!value || typeof value !== "object") return false;
  const target = value as HintTargetMove;
  return (
    Array.isArray(target.pips) &&
    target.pips.length === 2 &&
    target.pips.every((pip) => Number.isInteger(pip) && pip >= 0 && pip <= 6) &&
    target.pips[0] <= target.pips[1] &&
    Array.isArray(target.cells) &&
    target.cells.length === 2 &&
    target.cells.every(isSafeCell) &&
    adjacent(target.cells[0], target.cells[1]) &&
    Number.isInteger(target.firstPip) &&
    target.firstPip >= 0 &&
    target.firstPip <= 6 &&
    (target.firstPip === target.pips[0] || target.firstPip === target.pips[1]) &&
    Number.isSafeInteger(target.regionId) &&
    target.regionId >= 0 &&
    Array.isArray(target.regionCells) &&
    target.regionCells.every(isSafeCell)
  );
}

export function validateImportedProgressHints(value: {
  receipts?: unknown;
  offers?: unknown;
}): { receipts: HintReceipt[]; offers: PurchasedOffer[] } | null {
  const receipts = value.receipts == null ? [] : normalizeReceipts(value.receipts);
  if (!receipts) return null;
  if (value.offers == null) return { receipts, offers: [] };
  if (!Array.isArray(value.offers)) return null;
  const offers: PurchasedOffer[] = [];
  const seen = new Set<string>();
  const highest = new Map(
    highestTiersByOffer(receipts).map((move) => [move.offerId, move.highestTier]),
  );
  for (const item of value.offers) {
    if (!isValidPurchasedOffer(item)) return null;
    if (seen.has(item.id)) return null;
    seen.add(item.id);
    const paid = highest.get(item.id) ?? 0;
    if (item.highestTier < paid) return null;
    offers.push(item);
  }
  return { receipts, offers };
}

export function revealedHint(
  offer: HintOffer,
  puzzle: Puzzle,
  state: GameState,
): {
  regionCells: Cell[];
  tileIndex: number | null;
  placement: { d: number; cells: [Cell, Cell] } | null;
} {
  const placement = placementForOffer(puzzle, state, offer);
  if (offer.highestTier <= 0) {
    return { regionCells: [], tileIndex: null, placement: null };
  }
  return {
    regionCells: offer.target.regionCells,
    tileIndex: offer.highestTier >= 2 ? (placement?.d ?? null) : null,
    placement: offer.highestTier >= 3 ? placement : null,
  };
}

export function witnessIsCompatible(puzzle: Puzzle, state: GameState, witness: GameState): boolean {
  if (witness.length !== puzzle.dominoes.length || state.length !== puzzle.dominoes.length) {
    return false;
  }
  if (!evaluate(puzzle, witness).solved) return false;
  const current = occupancy(puzzle, state);
  const complete = occupancy(puzzle, witness);
  for (const [cell, { pip }] of current) {
    const next = complete.get(cell);
    if (!next || next.pip !== pip) return false;
  }
  return true;
}

export type HintSearchStatus = "found" | "impossible" | "unknown";

export type HintSearchRequest = {
  id: string;
  raw: import("./engine").RawPuzzle;
  state: GameState;
  puzzleHash: string;
  nodeBudget?: number;
  deadlineMs?: number;
};

export type HintSearchResponse =
  | {
      id: string;
      status: "found";
      offer: HintOffer;
      target: HintTargetMove;
      witness: GameState;
    }
  | { id: string; status: "impossible" | "unknown"; reason?: string };
