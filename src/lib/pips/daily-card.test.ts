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

test("averages and shares stay visible even without rotating facts", () => {
  const result = { first: 60000, best: 1000, plays: 9, solvedAt: "", lastAt: "" };
  const html = renderToStaticMarkup(
    React.createElement(card.DailyResultsCard, {
      summary: buildDailyResults("2026-09-19", { easy: result, medium: result, hard: result }),
      facts: [],
      metrics: {
        easy: { averageMs: 90000, count: 2, sharePercent: 100 / 3 },
        medium: { averageMs: 60000, count: 1, sharePercent: 100 / 3 },
        hard: { averageMs: null, count: 0, sharePercent: 100 / 3 },
      },
    }),
  );
  assert.match(html, /Average 01:30/);
  assert.match(html, /2 first solves/);
  assert.equal((html.match(/33.3%/g) ?? []).length, 3);
  assert.match(html, /Average —/);
});
