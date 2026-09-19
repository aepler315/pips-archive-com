import React from "react";
import { LEVELS } from "../lib/pips/engine";
import { formatResultDate, formatResultDuration, type DayResults } from "../lib/pips/daily-results";
import type { Stapipstic } from "../lib/pips/stapipstics";

export function DailyResultsCard({ summary, facts }: { summary: DayResults; facts: Stapipstic[] }) {
  return (
    <article className="daily-results-card" aria-label="Daily puzzle results">
      <header className="results-card-header">
        <div className="results-eyebrow">
          <span className="results-pip-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>{" "}
          THE DAILY THREE
        </div>
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
        <p className="results-date">Pips · {formatResultDate(summary.date)}</p>
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
            <span className="results-score-status">
              {summary.records[level] ? "Recorded" : "Not solved"}
            </span>
          </section>
        ))}
      </div>
      <div className="results-total">
        <span>{summary.complete ? "Total recorded time" : "Puzzles recorded"}</span>
        <strong>
          {summary.complete && summary.totalMs !== null
            ? formatResultDuration(summary.totalMs)
            : `${summary.solvedCount} / 3`}
        </strong>
      </div>
      {facts.length > 0 ? (
        <section className="results-facts" aria-label="Stapipstics">
          <h3>
            Stapipstics<span aria-hidden="true"> ✳</span>
          </h3>
          <p className="results-facts-intro">A few oddly satisfying facts.</p>
          <dl>
            {facts.map((f) => (
              <div key={f.id} className="results-fact">
                <dt>{f.label}</dt>
                <dd>
                  <strong>{f.value}</strong>
                  <span>{f.explanation}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      <footer className="results-card-brand">
        pipsarchive.com<span>First times. Yours to keep.</span>
      </footer>
    </article>
  );
}
