import React from "react";
import { LEVELS } from "../lib/pips/engine";
import { formatResultDate, formatResultDuration, type DayResults } from "../lib/pips/daily-results";
import type { Stapipstic } from "../lib/pips/stapipstics";

export function DailyResultsCard({ summary, facts }: { summary: DayResults; facts: Stapipstic[] }) {
  return (
    <article className="daily-results-card" aria-label="Daily puzzle results">
      <header className="results-card-header">
        <h2>
          {summary.complete ? (
            <>
              All three.
              <br />
              <em>Nicely done.</em>
            </>
          ) : (
            <>
              A little more.
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
