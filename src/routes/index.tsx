import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LEVELS, type Level } from "@/lib/pips/engine";
import { prefetchDay } from "@/lib/pips/days";
import { groupMonths, monthChip, monthLabel, resolveMonth } from "@/lib/pips/months";
import { allResults, fmt, type Result } from "@/lib/pips/store";
import type { ArchiveIndex, IndexEntry } from "@/lib/pips/types";
import archiveJson from "@/data/archive.json";
import { cn } from "@/lib/utils";

type Search = { month?: string };
type ResultMap = Map<string, Result>;
type CalCell = { day: number; entry: IndexEntry | null } | null;

const resultKeyOf = (date: string, level: Level) => `${date}:${level}`;

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    month: typeof raw.month === "string" && /^\d{4}-\d{2}$/.test(raw.month) ? raw.month : undefined,
  }),
  component: Home,
});

function pickRandomUnsolved(puzzles: IndexEntry[], results: ResultMap): [string, Level] | null {
  if (!puzzles.length) return null;
  const start = Math.floor(Math.random() * puzzles.length);
  for (let i = 0; i < puzzles.length; i++) {
    const p = puzzles[(start + i) % puzzles.length];
    const open = LEVELS.filter((l) => !results.has(resultKeyOf(p.date, l)));
    if (open.length) return [p.date, open[Math.floor(Math.random() * open.length)]];
  }
  return null;
}

function dayLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Weekday-major grid for a month: leading/trailing `null`s pad to full
 *  weeks, and an in-month day with no archived puzzle keeps its cell
 *  (greyed, unclickable) rather than collapsing like out-of-month padding. */
function calendarCells(ym: string, days: IndexEntry[]): CalCell[] {
  const [y, m] = ym.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells: CalCell[] = Array(firstDow).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${ym}-${String(day).padStart(2, "0")}`;
    cells.push({ day, entry: byDate.get(iso) ?? null });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function weekdayLabels() {
  // 2023-01-01 was a Sunday; walking a week from there gets locale-correct
  // narrow weekday initials without hardcoding English.
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" }),
  );
}

function Home() {
  const { month: requested } = Route.useSearch();
  const idx = archiveJson as ArchiveIndex;
  const [browser, setBrowser] = useState(false);
  useEffect(() => setBrowser(true), []);

  const puzzles = useMemo(() => idx.puzzles.slice().reverse(), [idx]);
  const months = useMemo(() => groupMonths(puzzles), [puzzles]);
  const monthKeys = months.map((g) => g.month);
  const active = resolveMonth(months, requested);
  const page = months.find((g) => g.month === active) ?? months[0];
  const pageI = monthKeys.indexOf(active);
  const older = pageI >= 0 && pageI < monthKeys.length - 1 ? monthKeys[pageI + 1] : null;
  const newer = pageI > 0 ? monthKeys[pageI - 1] : null;
  const cells = useMemo(() => calendarCells(active, page?.days ?? []), [active, page]);
  const weekdays = useMemo(weekdayLabels, []);

  // One localStorage scan for the whole page instead of one getItem+JSON.parse
  // per date-and-level (hundreds to thousands of calls as the archive grows).
  const results = useMemo<ResultMap>(() => {
    if (!browser) return new Map();
    return new Map(allResults().map((r) => [resultKeyOf(r.date, r.level), r]));
  }, [browser]);

  const solvedCount = useMemo(() => {
    if (!browser) return 0;
    return puzzles.reduce(
      (n, p) => n + LEVELS.filter((l) => results.has(resultKeyOf(p.date, l))).length,
      0,
    );
  }, [puzzles, browser, results]);

  const [selected, setSelected] = useState<IndexEntry | null>(null);

  useEffect(() => {
    prefetchDay(idx.last);
  }, [idx.last]);

  return (
    <div className="mx-auto min-h-screen max-w-[480px] px-3 py-4 sm:max-w-[720px] sm:px-6 sm:py-5">
      <SiteHeader current="archive" />
      <h1 className="font-display mt-5 text-[1.35rem] font-semibold tracking-tight sm:mt-8 sm:text-[1.65rem]">
        Every Pips, since the first one
      </h1>
      <p className="mt-1 mb-3 text-sm text-muted-foreground sm:mb-5 sm:text-base">
        {`${idx.count} days, ${idx.first} to ${idx.last}. You've solved ${solvedCount} of ${idx.count * 3}.`}
      </p>

      <details className="mb-3 text-sm text-muted-foreground sm:mb-5">
        <summary className="inline cursor-pointer select-none text-foreground underline decoration-foreground/30 underline-offset-4">
          How to play
        </summary>
        <p className="mt-1 max-w-[38rem] leading-relaxed">
          Place every domino so each colored region meets its rule: a number is a sum,{" "}
          <span className="text-foreground">=</span> means equal pips,{" "}
          <span className="text-foreground">≠</span> means all different, and{" "}
          <span className="text-foreground">{"< / >"}</span> compare the region's sum. Cream cells
          are free.
        </p>
      </details>

      <div className="mb-4 flex flex-wrap gap-2 sm:mb-6">
        <Link
          to="/play/$date/$level"
          params={{ date: idx.last, level: "easy" }}
          preload="intent"
          className="inline-flex h-9 items-center rounded-full bg-foreground px-3.5 text-sm font-medium text-background no-underline hover:bg-foreground/90 sm:h-10 sm:px-4"
        >
          Latest puzzle
        </Link>
        <RandomUnsolved puzzles={puzzles} results={results} />
      </div>

      <div className="rounded-[var(--radius-lg)] bg-card p-2.5 shadow-[inset_0_0_0_1px_var(--color-border)] sm:p-4">
        <div className="mb-1 flex items-center justify-between gap-2 sm:mb-3">
          {older ? (
            <Link
              to="/"
              search={{ month: older }}
              aria-label="Older month"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8 no-underline sm:size-10")}
            >
              <ChevronLeft className="size-4 sm:size-5" />
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8 opacity-40 sm:size-10")}>
              <ChevronLeft className="size-4 sm:size-5" />
            </span>
          )}
          <h2 className="font-display text-center text-base font-semibold sm:text-xl">
            {monthLabel(active)}
          </h2>
          {newer ? (
            <Link
              to="/"
              search={{ month: newer }}
              aria-label="Newer month"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8 no-underline sm:size-10")}
            >
              <ChevronRight className="size-4 sm:size-5" />
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-8 opacity-40 sm:size-10")}>
              <ChevronRight className="size-4 sm:size-5" />
            </span>
          )}
        </div>

        <div className="tile-rail mb-2 flex gap-1 overflow-x-auto pb-1 sm:mb-3">
          {[...monthKeys].reverse().map((m) => (
            <Link
              key={m}
              to="/"
              search={{ month: m }}
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] no-underline tabular-nums sm:px-2.5 sm:py-1 sm:text-xs",
                m === active
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {monthChip(m)}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] text-muted-foreground sm:text-xs">
          {weekdays.map((w, i) => (
            <div key={i} className="py-0.5">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map((cell, i) => (
            <DayCell key={i} cell={cell} results={results} onOpen={setSelected} />
          ))}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground sm:mt-6 sm:text-sm">
        {pageI + 1} of {monthKeys.length} months
      </p>

      <DayDialog entry={selected} results={results} onClose={() => setSelected(null)} />
    </div>
  );
}

function RandomUnsolved({ puzzles, results }: { puzzles: IndexEntry[]; results: ResultMap }) {
  const navigate = useNavigate();
  const [none, setNone] = useState(false);
  if (none) {
    return (
      <span className={cn(buttonVariants({ variant: "secondary" }), "h-9 opacity-40 sm:h-10")}>
        All solved
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "secondary" }), "h-9 px-3.5 sm:h-10 sm:px-4")}
      onClick={() => {
        const pick = pickRandomUnsolved(puzzles, results);
        if (!pick) {
          setNone(true);
          return;
        }
        prefetchDay(pick[0]);
        void navigate({
          to: "/play/$date/$level",
          params: { date: pick[0], level: pick[1] },
        });
      }}
    >
      Random unsolved
    </button>
  );
}

/** Solved = filled dot in the "ok" color already used for solved chips
 *  elsewhere; unsolved = a faint neutral dot. Position (left-to-right)
 *  always maps to easy/medium/hard, so color only needs to carry status. */
function DayCell({
  cell,
  results,
  onOpen,
}: {
  cell: CalCell;
  results: ResultMap;
  onOpen: (entry: IndexEntry) => void;
}) {
  if (!cell) return <div aria-hidden="true" />;
  const { day, entry } = cell;
  if (!entry) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center rounded-[var(--radius-sm)] text-xs text-muted-foreground/40 sm:text-sm">
        {day}
      </div>
    );
  }
  const solvedLevels = LEVELS.filter((l) => results.has(resultKeyOf(entry.date, l)));
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      aria-label={`${dayLabel(entry.date)} — ${solvedLevels.length} of ${LEVELS.length} solved`}
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] bg-background text-xs font-medium text-foreground shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-muted sm:text-sm",
        solvedLevels.length === LEVELS.length && "shadow-[inset_0_0_0_1.5px_var(--color-ok-ink)]",
      )}
    >
      <span className="tabular-nums">{day}</span>
      <span className="flex gap-0.5">
        {LEVELS.map((l) => (
          <span
            key={l}
            className={cn(
              "size-1.5 rounded-full",
              results.has(resultKeyOf(entry.date, l)) ? "bg-ok-ink" : "bg-muted-foreground/25",
            )}
          />
        ))}
      </span>
    </button>
  );
}

function DayDialog({
  entry,
  results,
  onClose,
}: {
  entry: IndexEntry | null;
  results: ResultMap;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {entry ? (
          <>
            <DialogTitle>{dayLabel(entry.date)}</DialogTitle>
            <DialogDescription>Pick a difficulty to view your time or play.</DialogDescription>
            <div className="mt-4 flex flex-col gap-2">
              {LEVELS.map((l) => {
                const r = results.get(resultKeyOf(entry.date, l));
                return (
                  <Link
                    key={l}
                    to="/play/$date/$level"
                    params={{ date: entry.date, level: l }}
                    onClick={onClose}
                    className={cn(
                      "flex items-center justify-between rounded-[var(--radius-md)] px-3.5 py-2.5 no-underline",
                      r ? "bg-ok text-ok-ink" : "bg-muted text-foreground hover:bg-muted/80",
                    )}
                  >
                    <span className="font-medium">{l[0].toUpperCase() + l.slice(1)}</span>
                    <span className="flex items-center gap-1.5 text-sm tabular-nums">
                      {r ? `Solved in ${fmt(r.best)}` : "Not solved"}
                      <ChevronsRight className="size-4" aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
