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
