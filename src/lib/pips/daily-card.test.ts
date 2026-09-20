import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as card from "../../components/daily-results-card";
import { buildDailyResults } from "./daily-results";
test("card exposes recorded times and truthful partial state without controls", () => {
  assert.equal(typeof card.DailyResultsCard, "function");
  const result = {
    first: 120000,
    best: 60000,
    plays: 2,
    solvedAt: "2026-09-19T00:00:00Z",
    lastAt: "2026-09-19T00:00:00Z",
  };
  const html = renderToStaticMarkup(
    React.createElement(card.DailyResultsCard, {
      summary: buildDailyResults("2026-09-19", { easy: result, medium: null, hard: null }),
      facts: [],
    }),
  );
  assert.match(html, /02:00/);
  assert.doesNotMatch(html, /01:00/);
  assert.equal((html.match(/Not solved/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<button|All three/);
});

test("completed card keeps date and times without redundant labels or decorations", () => {
  const result = {
    first: 62000,
    best: 62000,
    plays: 1,
    solvedAt: "2026-09-19T00:00:00Z",
    lastAt: "2026-09-19T00:00:00Z",
  };
  const html = renderToStaticMarkup(
    React.createElement(card.DailyResultsCard, {
      summary: buildDailyResults("2026-09-19", { easy: result, medium: result, hard: result }),
      facts: [
        {
          id: "throughput",
          family: "curiosity",
          group: "rate",
          label: "Pip throughput",
          value: "28.8 pips/min",
          explanation: "",
        },
      ],
    }),
  );
  assert.match(html, /Total time/);
  assert.match(html, /09\/19\/2026/);
  assert.doesNotMatch(
    html,
    /THE DAILY THREE|Recorded|recorded|oddly satisfying|Yours to keep|Pips ·|✳/,
  );
  assert.doesNotMatch(html, /<span><\/span>/);
});

test("each solved column carries one signed gap against its average, or nothing", () => {
  const result = { first: 60000, best: 1000, plays: 9, solvedAt: "", lastAt: "" };
  const html = renderToStaticMarkup(
    React.createElement(card.DailyResultsCard, {
      summary: buildDailyResults("2026-09-19", { easy: result, medium: result, hard: result }),
      facts: [],
      metrics: {
        easy: { averageMs: 90000, count: 2, deltaMs: -30000 },
        medium: { averageMs: 59500, count: 1, deltaMs: 500 },
        hard: { averageMs: null, count: 0, deltaMs: null },
      },
    }),
  );
  assert.match(html, /−00:30 vs avg/);
  // Under a second either way reads as "even" rather than a misleading +00:00.
  assert.match(html, /even vs avg/);
  // Hard has no history to compare against, so it gets no line at all.
  assert.equal((html.match(/vs avg/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Average|first solves|% of total/);
});

test("the winning-arrangement count leads the stapipstics list instead of owning a section", () => {
  const result = { first: 60000, best: 1000, plays: 9, solvedAt: "", lastAt: "" };
  const html = renderToStaticMarkup(
    React.createElement(card.DailyResultsCard, {
      summary: buildDailyResults("2026-09-19", { easy: result, medium: result, hard: result }),
      facts: [
        {
          id: "throughput",
          family: "curiosity" as const,
          group: "rate" as const,
          label: "Pip throughput",
          value: "28.8 pips/min",
          explanation: "Pips placed per minute across all three puzzles.",
        },
      ],
    }),
  );
  assert.equal((html.match(/<h3>/g) ?? []).length, 1);
  assert.match(html, /Stapipstics/);
  // Explanations are dropped from the card: label and value only.
  assert.match(html, /Pip throughput/);
  assert.doesNotMatch(html, /Pips placed per minute/);
});
