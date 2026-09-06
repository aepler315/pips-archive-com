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
  rotateTab,
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

type Sel = { kind: "tray" | "board"; d: number; end: 0 | 1 } | null;
type Anchor = { cell: Cell };

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

function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("mx-auto flex min-h-dvh flex-col px-4 py-5 sm:px-6", wide ? "max-w-[980px]" : "max-w-[720px]")}>
      <SiteHeader current="play" />
      {children}
    </div>
  );
}

function FitStage({
  aspect,
  onBlank,
  children,
}: {
  aspect: number;
  onBlank?: () => void;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const fit = () => {
      const width = el.getBoundingClientRect().width;
      if (width < 8) return;
      const w = Math.round(width);
      const h = Math.max(120, Math.round(width / aspect));
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);
  return (
    <div
      ref={host}
      className="w-full min-w-0"
      onPointerUp={(e) => {
        if (e.button !== 0) return;
        if (e.target === e.currentTarget) onBlank?.();
      }}
    >
      <div
        className="board-wrap mx-auto"
        onPointerUp={(e) => {
          if (e.button !== 0) return;
          if (e.target === e.currentTarget) onBlank?.();
        }}
        style={
          size.w
            ? { width: size.w, height: size.h }
            : { width: "100%", aspectRatio: String(aspect) }
        }
      >
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
  const tall = rows >= 6 || rows / Math.max(cols, 1) >= 1.25;
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
  const sideTray = tall && isMd;

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
  const tabHeld = useRef(false);
  const tabRot = useRef<{ d: number; n: number } | null>(null);
  const puzzleRef = useRef(puzzle);
  puzzleRef.current = puzzle;
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
      if (!solvedRef.current) saveProgress(date, level, stateRef.current, nowElapsed());
    };
  }, [date, level]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Tab") {
        e.preventDefault();
        tabHeld.current = true;
        if (e.repeat || solvedRef.current) return;
        const cur = selRef.current;
        const st = stateRef.current;
        const puz = puzzleRef.current;
        if (cur?.kind === "board" && st[cur.d]) {
          const prev = tabRot.current;
          const n = prev?.d === cur.d ? prev.n + 1 : 0;
          tabRot.current = { d: cur.d, n };
          const next = rotateTab(puz, st, cur.d, n);
          startClock();
          stateRef.current = next;
          setState(next);
          if (!solvedRef.current) saveProgress(date, level, next, nowElapsed());
          return;
        }
        if (cur?.kind === "tray" && !st[cur.d]) {
          holdSel({ ...cur, end: cur.end === 0 ? 1 : 0 });
        }
        return;
      }
      if (e.code !== "Escape") return;
      holdSel(null);
      holdAnchor(null);
      setFresh(null);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Tab") tabHeld.current = false;
    };
    const onBlur = () => {
      tabHeld.current = false;
    };
    addEventListener("keydown", onKeyDown);
    addEventListener("keyup", onKeyUp);
    addEventListener("blur", onBlur);
    return () => {
      removeEventListener("keydown", onKeyDown);
      removeEventListener("keyup", onKeyUp);
      removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    if (stateRef.current.some(Boolean)) return;
    const p = getProgress(date, level);
    if (p?.state?.some(Boolean) && p.state.length === puzzle.dominoes.length) {
      stateRef.current = p.state;
      setState(p.state);
      elapsedRef.current = p.elapsed ?? 0;
      setNow((n) => n + 1);
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

  function applyHold(next: GameState, hold: number | null, end: 0 | 1 = 0) {
    holdSel(hold == null ? null : { kind: "tray", d: hold, end });
    holdAnchor(null);
    afterMove(next);
  }

  function pick(d: number, end: 0 | 1 = 0) {
    if (solvedFlag) return;
    setFresh(null);
    lastTap.current = null;
    tabRot.current = null;
    const st = stateRef.current;
    const [a, b] = puzzle.dominoes[d];
    if (tabHeld.current) end = a >= b ? 0 : 1;
    const curSel = selRef.current;
    if (curSel?.kind === "tray" && curSel.d === d && curSel.end === end && !st[d]) {
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
      holdSel({ kind: "tray", d, end });
      holdAnchor(null);
      afterMove(remove(st, d));
      return;
    }
    lastPickup.current = null;
    applyHold(st, d, end);
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
    const end = selRef.current?.end ?? 0;
    const snapped = snapPlacement(puzzle, st, d, clicked, cur?.cell ?? null, end);
    if (snapped?.[d]) {
      afterMove(snapped);
      setFresh(d);
      markTap(d);
      holdSel(null);
      holdAnchor(null);
      tabRot.current = null;
      return;
    }
    if (cur) return;
    if (legalNeighbors(puzzle, st, d, clicked).length === 0) return;
    holdAnchor({ cell: clicked });
  }

  function clearSel() {
    holdSel(null);
    holdAnchor(null);
    setFresh(null);
    tabRot.current = null;
  }

  function onCell(cell: Cell) {
    if (solvedFlag) return;
    const st = stateRef.current;
    const curSel = selRef.current;
    const occupiedBy = st.findIndex(
      (p) => p && p.cells.some((c) => key(...c) === key(...cell)),
    );

    if (occupiedBy >= 0) {
      const placed = st[occupiedBy]!;
      let end: 0 | 1 = key(...placed.cells[0]) === key(...cell) ? 0 : 1;
      const [a, b] = puzzle.dominoes[occupiedBy];
      if (tabHeld.current) end = a >= b ? 0 : 1;
      const tap = lastTap.current;
      if (
        tap &&
        tap.d === occupiedBy &&
        performance.now() - tap.t < TAP_MS &&
        curSel?.kind === "board" &&
        curSel.d === occupiedBy &&
        curSel.end === end
      ) {
        pullOff(occupiedBy);
        return;
      }
      markTap(occupiedBy);
      if (tabRot.current?.d !== occupiedBy) tabRot.current = null;
      holdSel({ kind: "board", d: occupiedBy, end });
      holdAnchor(null);
      setFresh(null);
      lastPickup.current = null;
      return;
    }

    const lp = lastPickup.current;
    if (lp && performance.now() - lp.t < 280 && lp.keys.has(key(...cell))) {
      lastPickup.current = null;
      clearSel();
      return;
    }
    lastPickup.current = null;

    if (curSel?.kind === "board") {
      const d = curSel.d;
      const lifted = remove(st, d);
      const snapped = snapPlacement(puzzle, lifted, d, cell, null, curSel.end);
      if (snapped?.[d]) {
        afterMove(snapped);
        setFresh(d);
        markTap(d);
        holdSel(null);
        holdAnchor(null);
        tabRot.current = null;
        return;
      }
      if (legalNeighbors(puzzle, lifted, d, cell).length === 0) return;
      afterMove(lifted);
      holdSel({ kind: "tray", d, end: curSel.end });
      holdAnchor({ cell });
      return;
    }

    if (curSel?.kind !== "tray" || st[curSel.d]) {
      clearSel();
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
    : sel?.kind === "board"
      ? `${verb} a new cell to move it. Tab rotates.`
      : sel?.kind === "tray"
        ? anchor
          ? puzzle.dominoes[sel.d][0] === puzzle.dominoes[sel.d][1]
            ? `${verb} the other cell for this double.`
            : `${verb} a neighbouring cell to set the other half.`
          : `${verb} the cell this pip should sit on. Tab flips it.`
        : fresh != null
          ? mousey
            ? "Click to rotate, double-click to remove."
            : "Tap to rotate, double-tap to remove."
          : mousey
            ? "Click a domino, or a placed one to move it."
            : "Tap a domino, or a placed one to move it.";

  const prior = getResult(date, level);

  return (
    <Shell wide={sideTray}>
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

      <div className={cn("mt-3 flex gap-5", sideTray ? "flex-row items-start" : "flex-col")}>
      <div
        className={sideTray ? "min-w-0 flex-1" : "w-full"}
        onPointerUp={(e) => {
          if (e.button !== 0) return;
          if (e.target === e.currentTarget) clearSel();
        }}
      >
          <FitStage aspect={(cols + 1.4) / (rows + 1.4)} onBlank={clearSel}>
          <PipsBoard
            puzzle={puzzle}
            state={state}
            statuses={ev.regions}
            sel={sel}
            hold={sel?.kind === "tray" && !state[sel.d] ? sel.d : null}
            holdEnd={sel?.kind === "tray" ? sel.end : 0}
            pending={
              anchor && sel?.kind === "tray"
                ? {
                    cell: anchor.cell,
                    pip: puzzle.dominoes[sel.d][sel.end],
                  }
                : null
            }
            onCell={onCell}
            onBackground={clearSel}
          />
        </FitStage>
        </div>

        <div className={cn("min-w-0 shrink-0", sideTray ? "w-[14.5rem]" : "w-full")}>
          <p className="min-h-[1.4em] text-sm text-muted-foreground">{hint}</p>
          <PipsTray
            dominoes={puzzle.dominoes}
            placed={state.map(Boolean)}
            selected={sel?.kind === "tray" || sel?.kind === "board" ? sel.d : null}
            selectedEnd={sel?.kind === "tray" || sel?.kind === "board" ? sel.end : null}
            disabled={solvedFlag}
            onPick={pick}
            side={sideTray}
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
