import type { DayAnalysis } from "../lib/pips/puzzle-analysis";
import React from "react";
import { winningFact } from "../lib/pips/stapipstics-solutions";
import { LEVELS } from "../lib/pips/engine";
import {
  formatResultDate,
  formatResultDelta,
  formatResultDuration,
  type DayResults,
} from "../lib/pips/daily-results";
import type { Stapipstic } from "../lib/pips/stapipstics";

import { buildPersistentMetrics, type PersistentMetrics } from "../lib/pips/result-metrics";

export function DailyResultsCard({
  summary,
  facts,
  analysis = {},
  metrics = buildPersistentMetrics(summary, []),
}: {
  summary: DayResults;
  facts: Stapipstic[];
  analysis?: DayAnalysis;
  metrics?: PersistentMetrics;
}) {
  // The winning-arrangement count is a stapipstic like any other; it leads the
  // list rather than owning a second heading of its own.
  const winning = winningFact(summary, analysis);
  const rows = winning ? [winning, ...facts] : facts;
  return (
    <article className="daily-results-card" aria-label="Daily puzzle results">
      <header className="results-card-header">
        <h2>{summary.complete ? <>Pips <em>complete</em>.</> : <>Pips in progress.</>}</h2>
        <p className="results-date">{formatResultDate(summary.date)}</p>
      </header>
      <div className="results-scores">
        {LEVELS.map((level, i) => (
          <section
            className={`results-score results-score-${level}`}
            key={level}
            style={{ "--score-order": i } as React.CSSProperties}
            aria-label={`${level} result`}
          >
            <span className="results-score-label">{level[0].toUpperCase() + level.slice(1)}</span>
            <strong>
              {summary.records[level] ? formatResultDuration(summary.records[level].first) : "—"}
            </strong>
            {!summary.records[level] ? (
              <span className="results-score-status">Not solved</span>
            ) : metrics[level].deltaMs !== null ? (
              <span className="results-score-status">
                {formatResultDelta(metrics[level].deltaMs)} vs avg
              </span>
            ) : null}
          </section>
        ))}
      </div>
      <div className="results-total">
        <span>{summary.complete ? "Total time" : "Puzzles solved"}</span>
        <strong>
          {summary.complete && summary.totalMs !== null
            ? formatResultDuration(summary.totalMs)
            : `${summary.solvedCount} / 3`}
        </strong>
      </div>
      {rows.length > 0 ? (
        <section className="results-facts" aria-label="Stapipstics">
          <h3>Stapipstics</h3>
          <dl>
            {rows.map((f) => (
              <div key={f.id} className="results-fact">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      <footer className="results-card-brand">pipsarchive.com</footer>
    </article>
  );
}
