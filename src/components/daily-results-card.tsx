import type { DayAnalysis } from "../lib/pips/puzzle-analysis";
import React from "react";
import { winningFact } from "../lib/pips/stapipstics-solutions";
import { LEVELS } from "../lib/pips/engine";
import { formatResultDate, formatResultDuration, type DayResults } from "../lib/pips/daily-results";
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
  const winning = winningFact(summary, analysis);
  return (
    <article className="daily-results-card" aria-label="Daily puzzle results">
      <header className="results-card-header">
        <h2>
          {summary.complete ? (
            <>
              Pips complete.
              <br />
              <em>Nicely done.</em>
            </>
          ) : (
            <>
              Pips in progress.
              <br />
              <em>You’re on your way.</em>
            </>
          )}
        </h2>
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
            <div className="results-score-metrics">
              <span>
                {metrics[level].sharePercent === null
                  ? "—"
                  : `${metrics[level].sharePercent.toFixed(1)}%`}{" "}
                of total
              </span>
              <span>
                Average{" "}
                {metrics[level].averageMs === null
                  ? "—"
                  : formatResultDuration(metrics[level].averageMs)}
              </span>
              <small>
                {metrics[level].count} first solve{metrics[level].count === 1 ? "" : "s"}
              </small>
            </div>
            {!summary.records[level] ? (
              <span className="results-score-status">Not solved</span>
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
      <section className="results-winning" aria-label="Winning arrangements">
        <h3>Winning arrangements</h3>
        {winning ? (
          <div className="results-winning-count">
            <p>
              <strong>{winning.value}</strong>
            </p>
            <p className="text-sm text-muted-foreground">{winning.explanation}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            Winning-arrangement analysis unavailable
          </p>
        )}
      </section>
      {facts.length > 0 ? (
        <section className="results-facts" aria-label="Stapipstics">
          <h3>Stapipstics</h3>
          <dl>
            {facts.map((f) => (
              <div key={f.id} className="results-fact">
                <dt>{f.label}</dt>
                <dd>
                  <strong>{f.value}</strong>
                  {f.explanation ? <span>{f.explanation}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      <footer className="results-card-brand">pipsarchive.com</footer>
    </article>
  );
}
