import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { LEVELS } from "@/lib/pips/engine";
import {
  emptyBaseline,
  formatPerformance,
  buildPerformanceTimeline,
  summarizeCurrentForm,
} from "@/lib/pips/performance";
import { analyticsBlocked, ensurePerformance, readAnalytics } from "@/lib/pips/performance-store";
import type { AnchorRecord, PerformanceBaseline } from "@/lib/pips/performance-types";
export function PerformancePanel({ records }: { records: AnchorRecord[] }) {
  const [blocked, setBlocked] = useState(false);
  const [baseline, setBaseline] = useState<PerformanceBaseline>(emptyBaseline);
  useEffect(() => {
    let active = true;
    void ensurePerformance().then(() => {
      if (active) {
        setBaseline(readAnalytics(records)?.baseline ?? emptyBaseline());
        setBlocked(analyticsBlocked());
      }
    });
    return () => {
      active = false;
    };
  }, [records]);
  const form = summarizeCurrentForm(records, baseline);
  const timeline = buildPerformanceTimeline(records, baseline);
  return (
    <section
      aria-label="Personal performance"
      className="my-6 rounded-xl border border-border bg-card p-4"
    >
      {blocked ? (
        <p role="alert">
          Performance calibration is paused because saved or imported analytics could not be
          validated. Your solve times are safe. Import a matching analytics backup to restore your
          baseline.
        </p>
      ) : null}
      <h2 className="font-display text-xl font-semibold">Your performance</h2>
      <p className="text-sm text-muted-foreground">Difficulty-band adjusted · baseline 100</p>
      <p className="my-3 text-2xl font-semibold">
        {form.score === null
          ? "Building your baseline"
          : `${formatPerformance(form.score)} current form${form.status === "provisional" ? " · provisional" : ""}`}
      </p>
      <p className="text-sm text-muted-foreground">
        Your first 10 positive first-solve times in each level freeze your baseline. 125 means 20%
        less time than baseline. Replays never change your score. This adjusts for Easy, Medium and
        Hard, not each puzzle’s difficulty.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {LEVELS.map((level) => {
          const w = form.levels[level];
          return (
            <div key={level} className="min-w-0 rounded-lg bg-background p-3">
              <h3 className="font-semibold capitalize">{level}</h3>
              <p>
                {w.calibration < 10
                  ? `${w.calibration} / 10 calibration solves`
                  : `${formatPerformance(w.score)} pace index`}
              </p>
              <p className="text-sm text-muted-foreground">{w.count} / 10 post-baseline solves</p>
              {w.from && w.to ? (
                <p className="text-xs text-muted-foreground">
                  {new Date(w.from).toLocaleDateString()} – {new Date(w.to).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Overall form needs at least 3 post-baseline solves per level, and is provisional until each
        window has 10. The three levels have equal weight. Window dates show how recent each level
        is.
      </p>
      {timeline.some((p) => LEVELS.some((l) => p[l] !== null)) ? (
        <div
          aria-label="Performance by actual completion date"
          className="mt-4 h-56 w-full min-w-0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline} margin={{ left: 0, right: 12, top: 12, bottom: 8 }}>
              <XAxis
                dataKey="completed"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(n) =>
                  new Date(n).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                }
              />
              <YAxis width={48} tickFormatter={formatPerformance} />
              <Tooltip
                labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
                formatter={(v) => formatPerformance(Number(v))}
              />
              <ReferenceLine y={100} stroke="currentColor" strokeDasharray="3 3" />
              {LEVELS.map((l, i) => (
                <Line
                  key={l}
                  type="linear"
                  dataKey={l}
                  stroke={["#31836b", "#b68021", "#9a61b3"][i]}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </section>
  );
}
