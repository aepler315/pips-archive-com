import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { LEVELS, type Level } from "@/lib/pips/engine";
import { prefetchDay } from "@/lib/pips/days";
import { groupMonths, monthChip, monthLabel, resolveMonth } from "@/lib/pips/months";
import { fmt, getResult } from "@/lib/pips/store";
import type { ArchiveIndex, IndexEntry } from "@/lib/pips/types";
import archiveJson from "@/data/archive.json";
import { cn } from "@/lib/utils";

type Search = { month?: string };

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    month: typeof raw.month === "string" && /^\d{4}-\d{2}$/.test(raw.month) ? raw.month : undefined,
  }),
  component: Home,
});

function pickRandomUnsolved(puzzles: IndexEntry[]): [string, Level] | null {
  if (!puzzles.length) return null;
  const start = Math.floor(Math.random() * puzzles.length);
  for (let i = 0; i < puzzles.length; i++) {
    const p = puzzles[(start + i) % puzzles.length];
    const open = LEVELS.filter((l) => !getResult(p.date, l));
    if (open.length) return [p.date, open[Math.floor(Math.random() * open.length)]];
  }
  return null;
}

function dayLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
  });
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

  const solvedCount = useMemo(() => {
    if (!browser) return 0;
    return puzzles.reduce((n, p) => n + LEVELS.filter((l) => getResult(p.date, l)).length, 0);
  }, [puzzles, browser]);

  useEffect(() => {
    prefetchDay(idx.last);
  }, [idx.last]);

  return (
    <div className="mx-auto min-h-screen max-w-[720px] px-4 py-5 sm:px-6">
      <SiteHeader current="archive" />
      <h1 className="font-display mt-8 text-[1.65rem] font-semibold tracking-tight">
        Every Pips, since the first one
      </h1>
      <p className="mt-1 mb-5 text-muted-foreground">
        {`${idx.count} days, ${idx.first} to ${idx.last}. You've solved ${solvedCount} of ${idx.count * 3}.`}
      </p>
      <p className="mb-5 max-w-[38rem] text-sm leading-relaxed text-muted-foreground">
        Place every domino so each colored region meets its rule: a number is a sum,{" "}
        <span className="text-foreground">=</span> means equal pips,{" "}
        <span className="text-foreground">≠</span> means all different, and{" "}
        <span className="text-foreground">{"< / >"}</span> compare the region's sum. Cream cells are
        free.
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          to="/play/$date/$level"
          params={{ date: idx.last, level: "easy" }}
          preload="intent"
          className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background no-underline hover:bg-foreground/90"
        >
          Latest puzzle
        </Link>
        <RandomUnsolved puzzles={puzzles} />
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        {older ? (
          <Link
            to="/"
            search={{ month: older }}
            aria-label="Older month"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "no-underline")}
          >
            <ChevronLeft className="size-5" />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "opacity-40")}>
            <ChevronLeft className="size-5" />
          </span>
        )}
        <h2 className="font-display text-center text-xl font-semibold">{monthLabel(active)}</h2>
        {newer ? (
          <Link
            to="/"
            search={{ month: newer }}
            aria-label="Newer month"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "no-underline")}
          >
            <ChevronRight className="size-5" />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "opacity-40")}>
            <ChevronRight className="size-5" />
          </span>
        )}
      </div>

      <div className="mb-5 flex flex-wrap justify-center gap-1.5">
        {monthKeys.map((m) => (
          <Link
            key={m}
            to="/"
            search={{ month: m }}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs no-underline tabular-nums",
              m === active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {monthChip(m)}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {page?.days.map((p) => (
          <DayCard key={p.date} entry={p} ready={browser} />
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {pageI + 1} of {monthKeys.length} months
      </p>
    </div>
  );
}

function RandomUnsolved({ puzzles }: { puzzles: IndexEntry[] }) {
  const navigate = useNavigate();
  const [none, setNone] = useState(false);
  if (none) {
    return (
      <span className={cn(buttonVariants({ variant: "secondary" }), "opacity-40")}>All solved</span>
    );
  }
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "secondary" }))}
      onClick={() => {
        const pick = pickRandomUnsolved(puzzles);
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

function DayCard({ entry, ready }: { entry: IndexEntry; ready: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-card p-3 shadow-[inset_0_0_0_1px_var(--color-border)]">
      <div className="font-semibold">{dayLabel(entry.date)}</div>
      <div className="mt-2 flex gap-1.5">
        {LEVELS.map((l) => (
          <LevelChip key={l} date={entry.date} level={l} ready={ready} />
        ))}
      </div>
    </div>
  );
}

function LevelChip({ date, level, ready }: { date: string; level: Level; ready: boolean }) {
  const r = ready ? getResult(date, level) : null;
  return (
    <Link
      to="/play/$date/$level"
      params={{ date, level }}
      title={level}
      className={cn(
        "flex-1 rounded-[var(--radius-sm)] py-1 text-center text-xs no-underline tabular-nums",
        r ? "bg-ok text-ok-ink" : "bg-muted text-muted-foreground",
      )}
    >
      {r ? fmt(r.best) : level[0].toUpperCase()}
    </Link>
  );
}
