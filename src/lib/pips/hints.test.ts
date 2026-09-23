import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  emptyState,
  evaluate,
  parsePuzzle,
  place,
  validPlacements,
  type Cell,
  type RawDay,
} from "./engine.ts";
import {
  alignWitness,
  findCompletion,
  handleHintSearchRequest,
  searchHint,
} from "./hint-search.ts";
import {
  applyReceipt,
  freezeAssistance,
  isAssistedSnapshot,
  normalizeAssistance,
  normalizeReceipts,
  placementForOffer,
  planPurchase,
  scoredFirstMs,
  upgradeChargeMs,
  validateImportedProgressHints,
  visibleUpgradePrice,
  type HintOffer,
  type HintReceipt,
  type HintTier,
} from "./hints.ts";
import { buildDailyShareText } from "./result-sharing.ts";
import { buildDailyResults } from "./daily-results.ts";
import { eligible } from "./performance.ts";

const HASH = "a".repeat(64);
const day = JSON.parse(readFileSync("data/puzzles/2025-08-18.json", "utf8")) as RawDay;
const puzzle = parsePuzzle(day.easy);

function firstOffer(state = emptyState(puzzle)): HintOffer {
  const found = searchHint(puzzle, state, HASH);
  assert.equal(found.status, "found");
  return (found as { offer: HintOffer }).offer;
}

/** Buy tiers in order on one offer, returning the receipts the play page would keep. */
function buy(tiers: HintTier[], offer = firstOffer()): HintReceipt[] {
  let receipts: HintReceipt[] = [];
  let current = offer;
  for (const tier of tiers) {
    const plan = planPurchase(puzzle, emptyState(puzzle), current, tier, receipts);
    assert.ok(plan.status === "charge" || plan.status === "free");
    if (plan.status === "charge") receipts = applyReceipt(receipts, plan.receipt)!;
    current = plan.offer;
  }
  return receipts;
}

test("upgrading one hint costs its highest tier once", () => {
  assert.equal(upgradeChargeMs(0, 1), 15_000);
  assert.equal(upgradeChargeMs(1, 2), 45_000);
  assert.equal(upgradeChargeMs(2, 3), 180_000);
  assert.equal(upgradeChargeMs(3, 2), 0);
  assert.equal(visibleUpgradePrice(1, 3), "+03:45");
  assert.equal(visibleUpgradePrice(2, 2), "Free");
  const receipts = buy([1, 2, 3]);
  assert.equal(freezeAssistance(receipts).penaltyMs, 240_000);
});

test("repeat purchases are idempotent and downgrades are refused", () => {
  const offer = firstOffer();
  const receipts = buy([2], offer);
  const unlocked = { ...offer, highestTier: 2 as const };
  assert.equal(planPurchase(puzzle, emptyState(puzzle), unlocked, 2, receipts).status, "free");
  assert.equal(planPurchase(puzzle, emptyState(puzzle), unlocked, 1, receipts).status, "downgrade");
  const plan = planPurchase(puzzle, emptyState(puzzle), offer, 2, []);
  assert.equal(plan.status, "charge");
  if (plan.status !== "charge") return;
  assert.deepEqual(applyReceipt(receipts, plan.receipt), receipts);
});

test("an offer goes stale once its target cells are taken", () => {
  const offer = firstOffer();
  const placement = placementForOffer(puzzle, emptyState(puzzle), offer)!;
  const placed = place(puzzle, emptyState(puzzle), placement.d, ...placement.cells);
  assert.equal(planPurchase(puzzle, placed, offer, 1).status, "stale");
});

test("tampered receipts and snapshots are rejected rather than repriced", () => {
  const receipts = buy([1, 3]);
  assert.ok(normalizeReceipts(receipts));
  assert.equal(normalizeReceipts([{ ...receipts[0], chargedMs: 1 }]), null);
  assert.equal(normalizeReceipts(receipts.slice(1)), null, "an upgrade without its base");
  assert.equal(normalizeReceipts([...receipts].reverse()), null, "tiers must not go down");
  const snapshot = freezeAssistance(receipts);
  assert.deepEqual(normalizeAssistance(JSON.parse(JSON.stringify(snapshot))), snapshot);
  assert.equal(normalizeAssistance({ ...snapshot, penaltyMs: 0 }), null);
  assert.equal(normalizeAssistance({ ...snapshot, moves: [] }), null);
});

test("progress hints validate receipts against the offers they unlocked", () => {
  const offer = firstOffer();
  const receipts = buy([1, 2], offer);
  const offers = [{ ...offer, highestTier: 2 as const }];
  assert.deepEqual(validateImportedProgressHints({ receipts, offers }), { receipts, offers });
  assert.equal(
    validateImportedProgressHints({ receipts, offers: [{ ...offer, highestTier: 1 }] }),
    null,
    "an offer cannot claim less than was paid for it",
  );
  assert.equal(
    validateImportedProgressHints({ receipts, offers: [{ ...offers[0], id: "forged" }] }),
    null,
  );
});

test("scored time adds the penalty; legacy results score their raw time", () => {
  const assistance = freezeAssistance(buy([1, 2]));
  assert.equal(scoredFirstMs({ first: 90_000 }), 90_000);
  assert.equal(scoredFirstMs({ first: 90_000, assistance }), 150_000);
  assert.equal(isAssistedSnapshot(assistance), true);
  assert.equal(isAssistedSnapshot(undefined), false);
});

test("daily totals and share text use scored time and mark assisted levels", () => {
  const assistance = freezeAssistance(buy([3]));
  const base = {
    best: 0,
    solvedAt: "2026-09-01T00:00:00.000Z",
    lastAt: "2026-09-01T00:00:00.000Z",
    plays: 1,
  };
  const summary = buildDailyResults("2026-09-01", {
    easy: { ...base, first: 60_000, best: 60_000 },
    medium: { ...base, first: 100_000, best: 100_000, assistance },
    hard: { ...base, first: 200_000, best: 200_000 },
  });
  assert.equal(summary.totalMs, 600_000);
  assert.equal(
    buildDailyShareText(summary),
    "Pips 09/01/2026\nEasy: 01:00\nMedium: 05:40 💡\nHard: 03:20\npipsarchive.com",
  );
});

test("assisted first solves are never eligible for performance scoring", () => {
  const record = {
    date: "2026-09-01",
    level: "easy" as const,
    first: 60_000,
    solvedAt: "2026-09-01T00:00:00.000Z",
  };
  assert.equal(eligible(record), true);
  assert.equal(eligible({ ...record, assistance: freezeAssistance(buy([1])) }), false);
});

test("search returns a witness-backed move whose placement keeps the board solvable", () => {
  const found = findCompletion(puzzle, emptyState(puzzle));
  assert.equal(found.status, "found");
  let state = emptyState(puzzle);
  // Repeatedly buying Place must finish the puzzle, one verified move at a time.
  for (let i = 0; i < puzzle.dominoes.length; i++) {
    const offer = firstOffer(state);
    const placement = placementForOffer(puzzle, state, offer)!;
    const next = place(puzzle, state, placement.d, ...placement.cells);
    assert.notEqual(next, state);
    state = next;
  }
  assert.equal(evaluate(puzzle, state).solved, true);
});

test("a board that cannot be finished reports impossible, never a bogus move", () => {
  // Find a legal opening placement that no solution uses.
  const empty = emptyState(puzzle);
  const dead = puzzle.dominoes
    .flatMap((_, d) =>
      validPlacements(puzzle, empty, d).map((cells) => place(puzzle, empty, d, ...cells)),
    )
    .find((state) => findCompletion(puzzle, state).status === "impossible");
  assert.ok(dead, "fixture has a dead-end opening");
  assert.equal(searchHint(puzzle, dead, HASH).status, "impossible");
});

test("an exhausted budget reports unknown instead of guessing", () => {
  const hard = parsePuzzle(day.hard);
  assert.deepEqual(findCompletion(hard, emptyState(hard), { nodeBudget: 1 }), {
    status: "unknown",
    reason: "node-budget",
  });
  let t = 0;
  assert.deepEqual(findCompletion(hard, emptyState(hard), { now: () => (t += 10_000) }), {
    status: "unknown",
    reason: "time-budget",
  });
});

test("worker requests echo their id and reject malformed boards", () => {
  const ok = handleHintSearchRequest({
    id: "q1",
    raw: day.easy,
    state: emptyState(puzzle),
    puzzleHash: HASH,
  });
  assert.equal(ok.id, "q1");
  assert.equal(ok.status, "found");
  const bad = handleHintSearchRequest({ id: "q2", raw: day.easy, state: [], puzzleHash: HASH });
  assert.deepEqual(bad, { id: "q2", status: "unknown", reason: "invalid" });
});

test("the published solution answers instantly on boards that still agree with it", () => {
  const hardDay = JSON.parse(readFileSync("data/puzzles/2025-09-07.json", "utf8")) as RawDay;
  const hard = parsePuzzle(hardDay.hard);
  const solution = hardDay.hard.solution!;
  // This board is out of reach of the bounded search on its own.
  assert.equal(findCompletion(hard, emptyState(hard), { nodeBudget: 20_000 }).status, "unknown");
  let state = emptyState(hard);
  for (let i = 0; i < hard.dominoes.length; i++) {
    const found = searchHint(hard, state, HASH, { nodeBudget: 1 }, solution);
    assert.equal(found.status, "found");
    if (found.status !== "found") return;
    const placement = placementForOffer(hard, state, found.offer)!;
    state = place(hard, state, placement.d, ...placement.cells);
  }
  assert.equal(evaluate(hard, state).solved, true);
});

test("aligning the solution follows the player's own dominoes and pairings", () => {
  const solution = day.easy.solution!;
  const empty = emptyState(puzzle);
  assert.ok(alignWitness(puzzle, empty, solution));
  // A domino placed exactly as published keeps its cells in the witness.
  const right = place(puzzle, empty, 0, ...solution[0]);
  assert.deepEqual(alignWitness(puzzle, right, solution)?.[0], right[0]);
  // A placement the solution does not contain rules the solution out.
  const reversed: [Cell, Cell] = [solution[1][1], solution[1][0]];
  const wrong = place(puzzle, empty, 1, ...reversed);
  if (wrong !== empty) assert.equal(alignWitness(puzzle, wrong, solution), null);
  assert.equal(alignWitness(puzzle, empty, solution.slice(1)), null);
});
