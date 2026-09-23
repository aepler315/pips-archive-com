import { scoredFirstMs } from "./hints";
import { LEVELS, type RawDay } from "./engine";
import { type DayResults } from "./daily-results";
import { collector, name, gapText } from "./stapipstics-extra-types";
const pairKey = ([a, b]: number[]) => `${Math.min(a, b)}–${Math.max(a, b)}`;
export function compositionFacts(summary: DayResults, raw: RawDay) {
  const { facts, add } = collector([
    "balanced",
    "small-mighty",
    "double-take",
    "family",
    "unique",
    "shared",
    "exclusive",
    "opposites",
    "seven",
    "squeeze",
    "room",
    "tiny",
    "same-pieces",
  ]);
  const dominoes = LEVELS.flatMap((l) => raw[l].dominoes);
  if (
    raw.printDate !== summary.date ||
    !dominoes.length ||
    !dominoes.every(
      (d) => d.length === 2 && d.every((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    )
  )
    return facts;
  const halves = dominoes.flat();
  const payload = halves.reduce((a, b) => a + b, 0);
  const odd = halves.filter((n) => n % 2 === 1).reduce((a, b) => a + b, 0),
    even = payload - odd;
  if (payload > 0 && Math.abs(odd - even) / payload <= 0.05)
    add(
      "balanced",
      "halves",
      odd === even ? "Perfectly balanced" : "Nearly balanced",
      `${odd} odd-side pips · ${even} even-side pips`,
      "Pip totals on odd-valued versus even-valued halves.",
      odd === even ? 98 : 85,
    );
  const levels = LEVELS.map((level) => ({
    level,
    dominoes: raw[level].dominoes,
    pairs: new Set(raw[level].dominoes.map(pairKey)),
    pips: raw[level].dominoes.flat().reduce((a, b) => a + b, 0),
  }));
  const mighty = levels
    .map((l) => ({
      ...l,
      excess: payload > 0 ? l.pips / payload - l.dominoes.length / dominoes.length : 0,
    }))
    .sort((a, b) => b.excess - a.excess)[0];
  if (mighty.excess >= 0.1)
    add(
      "small-mighty",
      "cross-puzzle",
      "Small but mighty",
      `${name(mighty.level)} holds ${((100 * mighty.pips) / payload).toFixed(1)}% of the pips`,
      `With ${((100 * mighty.dominoes.length) / dominoes.length).toFixed(1)}% of the dominoes.`,
      75 + 20 * mighty.excess,
    );
  const doubles = Array.from({ length: 7 }, (_, pip) => ({
    pip,
    count: dominoes.filter(([a, b]) => a === pip && b === pip).length,
  })).sort((a, b) => b.count - a.count);
  if (doubles[0].count >= 2) {
    const leaders = doubles.filter((d) => d.count === doubles[0].count);
    add(
      "double-take",
      "pairs",
      "Double take",
      leaders.map((d) => `${d.count} double-${d.pip}s`).join(" · "),
      leaders.length === 1
        ? "The most frequent double across all three puzzles."
        : "Tied for the most frequent double.",
      70 + (20 * doubles[0].count) / dominoes.length,
    );
  }
  const family = levels.filter((l) => new Set(l.dominoes.flat()).size === 7);
  if (family.length)
    add(
      "family",
      "halves",
      "The whole family",
      family.map((l) => name(l.level)).join(" & "),
      "Every pip value from blank through six appears in each listed puzzle.",
      80 + family.length * 3,
    );
  const counts = new Map<string, number>();
  for (const d of dominoes) counts.set(pairKey(d), (counts.get(pairKey(d)) ?? 0) + 1);
  const unique = [...counts.values()].filter((n) => n === 1).length;
  if (unique)
    add(
      "unique",
      "pairs",
      "One of a kind",
      `${unique} unique domino${unique === 1 ? "" : "es"}`,
      "Pip pairs that appear exactly once across all three puzzles.",
      50 + (35 * unique) / dominoes.length,
    );
  const shared = [...levels[0].pairs].filter((p) => levels.every((l) => l.pairs.has(p)));
  if (shared.length)
    add(
      "shared",
      "cross-puzzle",
      "Shared DNA",
      `${shared.length} shared pair${shared.length === 1 ? "" : "s"}`,
      "Distinct pip pairs found in all three difficulties.",
      65 + (25 * shared.length) / Math.max(1, counts.size),
    );
  const exclusive = levels
    .map((l) => ({
      ...l,
      count: [...l.pairs].filter((p) =>
        levels.every((other) => other.level === l.level || !other.pairs.has(p)),
      ).length,
    }))
    .sort((a, b) => b.count - a.count);
  if (exclusive[0].count)
    add(
      "exclusive",
      "cross-puzzle",
      "Exclusive company",
      `${name(exclusive[0].level)} · ${exclusive[0].count} exclusive pair${exclusive[0].count === 1 ? "" : "s"}`,
      "Distinct pip pairs absent from both other difficulties.",
      60 + (25 * exclusive[0].count) / exclusive[0].pairs.size,
    );
  const opposites = dominoes.filter(([a, b]) => Math.abs(a - b) >= 5).length;
  if (opposites)
    add(
      "opposites",
      "pairs",
      "Opposites attract",
      `${opposites} of ${dominoes.length} dominoes`,
      "Their halves differ by five or six pips.",
      60 + (30 * opposites) / dominoes.length,
    );
  const seven = dominoes.filter(([a, b]) => a + b === 7).length;
  if (seven)
    add(
      "seven",
      "pairs",
      "Lucky seven",
      `${seven} of ${dominoes.length} dominoes`,
      "Their two halves total seven pips.",
      55 + (35 * seven) / dominoes.length,
    );
  const regions = LEVELS.flatMap((l) => raw[l].regions);
  const known = new Set(["empty", "sum", "equals", "unequal", "less", "greater"]);
  if (regions.every((r) => known.has(r.type))) {
    const density = LEVELS.map((level) => {
      const rs = raw[level].regions;
      const cells = rs.reduce((n, r) => n + r.indices.length, 0);
      const rules = rs.filter((r) => r.type !== "empty" && r.indices.length > 0).length;
      return { level, cells, rules, ratio: cells ? rules / cells : 0 };
    }).sort((a, b) => b.ratio - a.ratio);
    if (density[0].rules) {
      const leaders = density.filter((l) => l.ratio === density[0].ratio);
      add(
        "squeeze",
        "rules",
        "The tightest squeeze",
        leaders.map((l) => name(l.level)).join(" & "),
        leaders
          .map((l) => `${l.rules} rule region${l.rules === 1 ? "" : "s"} / ${l.cells} cells`)
          .join(" · "),
        55 + 35 * density[0].ratio,
      );
    }
    const room = Math.max(
      0,
      ...regions.filter((r) => r.type === "empty").map((r) => r.indices.length),
    );
    if (room)
      add(
        "room",
        "rules",
        "Room to breathe",
        `${room} cells`,
        "The largest single unrestricted region.",
        55 +
          (30 * room) /
            Math.max(
              1,
              regions.reduce((n, r) => n + r.indices.length, 0),
            ),
      );
    const tiny = regions.filter((r) => r.type !== "empty" && r.indices.length === 1).length;
    if (tiny)
      add(
        "tiny",
        "rules",
        "Tiny kingdoms",
        `${tiny} single-cell rule region${tiny === 1 ? "" : "s"}`,
        "Each rule applies to just one cell.",
        60 + (25 * tiny) / regions.length,
      );
  }
  const overlaps = levels
    .flatMap((a, i) =>
      levels.slice(i + 1).map((b) => {
        const intersection = [...a.pairs].filter((p) => b.pairs.has(p)).length;
        const union = new Set([...a.pairs, ...b.pairs]).size;
        const ar = summary.records[a.level],
          br = summary.records[b.level];
        const at = ar ? scoredFirstMs(ar) : undefined,
          bt = br ? scoredFirstMs(br) : undefined;
        const gap = at !== undefined && bt !== undefined ? Math.abs(at - bt) : 0;
        const difference =
          at !== undefined && bt !== undefined && Math.max(at, bt) > 0 ? gap / Math.max(at, bt) : 0;
        return {
          a,
          b,
          intersection,
          union,
          gap,
          difference,
          overlap: union ? intersection / union : 0,
        };
      }),
    )
    .filter((p) => p.overlap >= 0.5 && p.difference >= 0.2)
    .sort((a, b) => b.overlap * b.difference - a.overlap * a.difference);
  const overlap = overlaps[0];
  if (overlap)
    add(
      "same-pieces",
      "cross-puzzle",
      "Same pieces, different story",
      `${name(overlap.a.level)} & ${name(overlap.b.level)} · ${gapText(overlap.gap)} apart`,
      `${overlap.intersection} shared distinct pairs out of ${overlap.union} in their combined set.`,
      86 + 12 * overlap.overlap * overlap.difference,
    );
  return facts;
}
