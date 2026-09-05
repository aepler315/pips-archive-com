import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PipsBoard } from "@/components/pips-board";
import { PipsTray } from "@/components/pips-tray";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  LEVELS,
  emptyState,
  evaluate,
  key,
  legalNeighbors,
  parsePuzzle,
  remove,
  rotatePlaced,
  snapPlacement,
  type Cell,
  type GameState,
  type Level,
  type RawDay,
} from "@/lib/pips/engine";
import {
  clearProgress,
  clockMs,
  fmt,
  getProgress,
  getResult,
  recordSolve,
  saveProgress,
} from "@/lib/pips/store";
import { cn } from "@/lib/utils";
import { loadDay } from "@/lib/pips/days";
import { boundsOf, puzzleCells } from "@/lib/pips/geometry";

export const Route = createFileRoute("/play/$date/$level")({
  loader: async ({ params }) => {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? await loadDay(params.date) : undefined;
    return { day: day ?? null };
  },
  pendingMs: 200,
  pendingComponent: PlayPending,
  component: PlayPage,
});

type Sel = { kind: "tray" | "board"; d: number } | null;
type Anchor = { cell: Cell; high: boolean };

const TAP_MS = 320;

function PlayPending() {
  return (
    <Shell>
      <p className="mt-8 text-muted-foreground">Loading puzzle…</p>
    </Shell>
  );
}

function PlayPage() {
  const { date, level: rawLevel } = Route.useParams();
  const { day } = Route.useLoaderData();
  const level: Level = LEVELS.includes(rawLevel as Level) ? (rawLevel as Level) : "easy";
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);

  if (!dateOk) {
    return (
      <Shell>
        <h1 className="font-display mt-8 text-2xl font-semibold">No puzzle chosen</h1>
        <p className="text-muted-foreground">
          Pick a date from the <Link to="/">archive</Link>.
        </p>
      </Shell>
    );
  }
  if (!day) {
    return (
      <Shell>
        <h1 className="font-display mt-8 text-2xl font-semibold">No puzzle for {date}</h1>
        <p className="text-muted-foreground">
          It may not be archived yet. <Link to="/">Back to the archive</Link>.
        </p>
      </Shell>
    );
  }
  return <Play key={`${date}-${level}`} date={date} level={level} raw={day} />;
}

function Shell({ children, wide, lock }: { children: ReactNode; wide?: boolean; lock?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto flex flex-col px-4 py-5 sm:px-6",
        lock ? "h-dvh overflow-hidden" : "min-h-dvh",
        wide ? "max-w-[980px]" : "max-w-[720px]",
      )}
    >
      <SiteHeader current="play" />
      {children}
    </div>
  );
}

function FitStage({
  aspect,
  contain,
  children,
}: {
  aspect: number;
  contain?: boolean;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 280 });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 8) return;
      let w: number;
      let h: number;
      if (contain) {
        if (height < 8) return;
        w = width;
        h = height;
        if (w / h > aspect) w = h * aspect;
        else h = w / aspect;
      } else {
        w = width;
        h = width / aspect;
      }
      w = Math.round(w);
      h = Math.round(h);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect, contain]);
  return (
    <div
      ref={host}
      className={cn(
        "pointer-events-none flex w-full items-center justify-center",
        contain ? "min-h-0 min-w-0 flex-1" : "shrink-0",
      )}
    >
      <div className="board-wrap pointer-events-auto" style={{ width: size.w, height: size.h }}>
        {children}
      </div>
    </div>
  );
}

function Play({ date, level, raw }: { date: string; level: Level; raw: RawDay }) {
  const puzzle = useMemo(() => parsePuzzle(raw[level]), [raw, level]);
  const dateLabel = useMemo(
    () =>
      new Date(date + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [date],
  );
  const bounds = useMemo(() => boundsOf(puzzleCells(puzzle)), [puzzle]);
  const rows = bounds.maxR - bounds.minR + 1;
  const cols = bounds.maxC - bounds.minC + 1;
  const sideTray = rows >= 6 || rows / Math.max(cols, 1) >= 1.25;
  const [isMd, setIsMd] = useState(false);
  const [mousey, setMousey] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const go = () => {
      setIsMd(wide.matches);
      setMousey(hover.matches);
    };
    go();
    wide.addEventListener("change", go);
    hover.addEventListener("change", go);
    return () => {
      wide.removeEventListener("change", go);
      hover.removeEventListener("change", go);
    };
  }, []);
  const contain = sideTray && isMd;

  const [state, setState] = useState<GameState>(() => {
    const p = getProgress(date, level);
    if (p?.state?.length === puzzle.dominoes.length) return p.state;
    return emptyState(puzzle);
  });
  const [solvedFlag, setSolvedFlag] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [solveMs, setSolveMs] = useState<number | null>(null);
  const [solveDetail, setSolveDetail] = useState("");
  const [, setNow] = useState(0);

  const elapsedRef = useRef(0);
  const tickStart = useRef<number | null>(null);
  const solvedRef = useRef(false);
  const stateRef = useRef(state);
  const selRef = useRef<Sel>(null);
  const lastPickup = useRef<{ d: number; keys: Set<string>; t: number } | null>(null);
  const lastTap = useRef<{ d: number; t: number } | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const anchorRef = useRef<Anchor | null>(null);
  stateRef.current = state;
  selRef.current = sel;
  function holdAnchor(a: Anchor | null) {
    anchorRef.current = a;
    setAnchor(a);
  }
  function holdSel(s: Sel) {
    selRef.current = s;
    setSel(s);
  }
  if (tickStart.current === null && !solvedRef.current) {
    tickStart.current = performance.now();
  }

  const ev = useMemo(() => evaluate(puzzle, state), [puzzle, state]);

  const nowElapsed = () => clockMs(elapsedRef.current, tickStart.current, performance.now());

  const startClock = () => {
    if (tickStart.current === null && !solvedRef.current) tickStart.current = performance.now();
  };

  const stopClock = () => {
    if (tickStart.current !== null) {
      elapsedRef.current = clockMs(elapsedRef.current, tickStart.current, performance.now());
      tickStart.current = null;
    }
  };

  useEffect(() => {
    startClock();
    const id = setInterval(() => setNow((n) => n + 1), 250);
    const vis = () => {
      if (document.hidden) {
        stopClock();
        if (!solvedRef.current) saveProgress(date, level, stateRef.current, nowElapsed());
      } else {
        startClock();
      }
    };
    document.addEventListener("visibilitychange", vis);
    const hide = () => {
      stopClock();
      if (!solvedRef.current) saveProgress(date, level, stateRef.current, nowElapsed());
    };
    addEventListener("pagehide", hide);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
      removeEventListener("pagehide", hide);
    };
  }, [date, level]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      holdSel(null);
      holdAnchor(null);
      setFresh(null);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const p = getProgress(date, level);
    if (p?.state?.length === puzzle.dominoes.length) {
      stateRef.current = p.state;
      setState(p.state);
      elapsedRef.current = p.elapsed ?? 0;
    }
  }, [date, level, puzzle.dominoes.length]);

  useEffect(() => {
    if (ev.solved && !solvedRef.current) {
      const ms = nowElapsed();
      stopClock();
      solvedRef.current = true;
      setSolvedFlag(true);
      holdSel(null);
      holdAnchor(null);
      const res = recordSolve(date, level, ms);
      setSolveMs(ms);
      setSolveDetail(res.plays > 1 ? `Best ${fmt(res.best)} over ${res.plays} plays.` : "First solve.");
    }
  }, [ev.solved, date, level]);

  function afterMove(next: GameState) {
    startClock();
    stateRef.current = next;
    setState(next);
    if (!solvedRef.current) saveProgress(date, level, next, nowElapsed());
  }

  function applyHold(next: GameState, hold: number | null) {
    holdSel(hold == null ? null : { kind: "tray", d: hold });
    holdAnchor(null);
    afterMove(next);
  }

  function pick(d: number) {
    if (solvedFlag) return;
    setFresh(null);
    lastTap.current = null;
    const st = stateRef.current;
    const curSel = selRef.current;
    if (curSel?.kind === "tray" && curSel.d === d && !st[d]) {
      holdSel(null);
      holdAnchor(null);
      lastPickup.current = null;
      return;
    }
    if (st[d]) {
      lastPickup.current = {
        d,
        keys: new Set(st[d]!.cells.map((c) => key(...c))),
        t: performance.now(),
      };
      holdSel({ kind: "tray", d });
      holdAnchor(null);
      afterMove(remove(st, d));
      return;
    }
    lastPickup.current = null;
    applyHold(st, d);
  }

  function markTap(d: number) {
    lastTap.current = { d, t: performance.now() };
  }

  function pullOff(d: number) {
    lastTap.current = null;
    lastPickup.current = null;
    if (fresh === d) setFresh(null);
    const cur = selRef.current;
    const keepHold = cur?.kind === "tray" && cur.d !== d && !stateRef.current[cur.d];
    if (!keepHold) {
      holdSel(null);
      holdAnchor(null);
    }
    afterMove(remove(stateRef.current, d));
  }

  function dropOn(d: number, clicked: Cell) {
    lastPickup.current = null;
    const st = stateRef.current;
    const cur = anchorRef.current;
    const snapped = snapPlacement(puzzle, st, d, clicked, cur?.cell ?? null);
    if (snapped?.[d]) {
      afterMove(snapped);
      setFresh(d);
      markTap(d);
      holdSel(null);
      holdAnchor(null);
      return;
    }
    if (cur) return;
    if (legalNeighbors(puzzle, st, d, clicked).length === 0) return;
    holdAnchor({ cell: clicked, high: true });
  }

  function onCell(cell: Cell) {
    if (solvedFlag) return;
    const st = stateRef.current;
    const curSel = selRef.current;
    const occupiedBy = st.findIndex(
      (p) => p && p.cells.some((c) => key(...c) === key(...cell)),
    );
    const holding = curSel?.kind === "tray" && !st[curSel.d];
    if (occupiedBy >= 0) {
      const tap = lastTap.current;
      if (tap && tap.d === occupiedBy && performance.now() - tap.t < TAP_MS) {
        pullOff(occupiedBy);
        return;
      }
      markTap(occupiedBy);
      if (!holding) afterMove(rotatePlaced(puzzle, st, occupiedBy));
      return;
    }
    const lp = lastPickup.current;
    if (lp && performance.now() - lp.t < 280 && lp.keys.has(key(...cell))) {
      lastPickup.current = null;
      holdSel(null);
      holdAnchor(null);
      return;
    }
    lastPickup.current = null;
    if (curSel?.kind !== "tray" || st[curSel.d]) {
      holdSel(null);
      holdAnchor(null);
      setFresh(null);
      return;
    }
    dropOn(curSel.d, cell);
  }

  function reset() {
    if (!confirm("Clear the board and restart the clock?")) return;
    stopClock();
    elapsedRef.current = 0;
    solvedRef.current = false;
    const empty = emptyState(puzzle);
    stateRef.current = empty;
    setState(empty);
    setSolvedFlag(false);
    holdSel(null);
    holdAnchor(null);
    setFresh(null);
    setSolveMs(null);
    clearProgress(date, level);
    startClock();
  }

  async function share() {
    const text = `Pips ${date} ${level}: ${fmt(solveMs ?? nowElapsed())}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* cancelled */
    }
  }

  const verb = mousey ? "Click" : "Tap";
  const hint = solvedFlag
    ? ""
    : fresh != null
      ? mousey
        ? "Click to rotate, double-click to remove."
        : "Tap to rotate, double-tap to remove."
      : sel?.kind === "tray"
        ? anchor
          ? puzzle.dominoes[sel.d][0] === puzzle.dominoes[sel.d][1]
            ? `${verb} the other cell for this double.`
            : `${verb} a neighbouring cell to set the other half.`
          : mousey
            ? "Hover to preview a snap. Click the cell for the larger pip."
            : "Drag onto a cell to preview, lift to place."
        : mousey
          ? "Click a domino, then a cell."
          : "Tap a domino, then a cell.";

  const prior = getResult(date, level);

  return (
    <Shell wide={sideTray} lock={contain}>
      <h1 className="font-display mt-7 text-[1.45rem] font-semibold tracking-tight">{dateLabel}</h1>
      <p className="mt-1 text-muted-foreground">
        {level[0].toUpperCase() + level.slice(1)} · by {raw[level].constructors ?? "unknown"}
      </p>

      <div className="mt-4 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-muted p-0.5">
          {LEVELS.map((l) => {
            const done = !!getResult(date, l);
            return (
              <Link
                key={l}
                to="/play/$date/$level"
                params={{ date, level: l }}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm no-underline",
                  l === level ? "bg-foreground text-background" : "text-muted-foreground",
                )}
              >
                {l[0].toUpperCase() + l.slice(1)}
                {done ? " ✓" : ""}
              </Link>
            );
          })}
        </div>
        <div
          className={cn(
            "min-w-[4.5ch] text-right font-medium text-[1.35rem] tabular-nums",
            tickStart.current === null && "text-muted-foreground",
          )}
        >
          {fmt(nowElapsed())}
        </div>
      </div>

      {solveMs !== null ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-ok px-4 py-3 text-ok-ink">
          <div>
            Solved in <strong className="text-xl tabular-nums">{fmt(solveMs)}</strong>{" "}
            <span>{solveDetail}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={share}>
            Share
          </Button>
        </div>
      ) : prior && !getProgress(date, level) && !state.some(Boolean) ? (
        <p className="mb-2 text-sm text-muted-foreground">
          You solved this in {fmt(prior.first)}. Playing again keeps your best.
        </p>
      ) : null}

      <div
        className={cn(
          "mt-3 flex",
          contain
            ? "min-h-0 flex-1 flex-row items-stretch gap-5"
            : "flex-col",
        )}
      >
        <FitStage aspect={(cols + 1.4) / (rows + 1.4)} contain={contain}>
          <PipsBoard
            puzzle={puzzle}
            state={state}
            statuses={ev.regions}
            sel={sel}
            hold={sel?.kind === "tray" && !state[sel.d] ? sel.d : null}
            pending={
              anchor && sel?.kind === "tray"
                ? {
                    cell: anchor.cell,
                    pip: Math.max(...puzzle.dominoes[sel.d]),
                  }
                : null
            }
            onCell={onCell}
            onBackground={() => {
              holdSel(null);
              holdAnchor(null);
              setFresh(null);
            }}
          />
        </FitStage>

        <div className={cn("mt-3 min-w-0 shrink-0", sideTray && "md:mt-0 md:w-[13.75rem] md:overflow-y-auto")}>
          <p className="min-h-[1.4em] text-sm text-muted-foreground">{hint}</p>
          <PipsTray
            dominoes={puzzle.dominoes}
            placed={state.map(Boolean)}
            selected={sel?.kind === "tray" ? sel.d : null}
            disabled={solvedFlag}
            onPick={pick}
            side={contain}
          />
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {ev.placed} / {ev.total} placed
            </span>
            <Button variant="ghost" size="sm" onClick={reset}>
              Clear board
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
