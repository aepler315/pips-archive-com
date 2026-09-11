import { useEffect, useMemo, useRef } from "react";
import { PIP_LAYOUT } from "@/lib/pips/geometry";
import { cn } from "@/lib/utils";

function MiniPips({ x, y, v }: { x: number; y: number; v: number }) {
  return (
    <g>
      {(PIP_LAYOUT[v] ?? []).map(([px, py], i) => (
        <circle key={i} cx={x + px} cy={y + py} r={0.09} className="fill-foreground" />
      ))}
    </g>
  );
}

function MiniTile({ a, b, end }: { a: number; b: number; end?: 0 | 1 | null }) {
  return (
    <svg viewBox="0 0 2 1" className="pointer-events-none block h-auto w-full">
      <rect
        x={0.08}
        y={0.08}
        width={1.84}
        height={0.84}
        rx={0.16}
        className="fill-card stroke-foreground"
        strokeWidth={0.05}
      />
      <line x1={1} y1={0.2} x2={1} y2={0.8} className="stroke-foreground/35" strokeWidth={0.035} />
      {end === 0 && (
        <rect
          x={0.1}
          y={0.1}
          width={0.86}
          height={0.8}
          rx={0.14}
          className="fill-ring/25 stroke-ring"
          strokeWidth={0.05}
        />
      )}
      {end === 1 && (
        <rect
          x={1.04}
          y={0.1}
          width={0.86}
          height={0.8}
          rx={0.14}
          className="fill-ring/25 stroke-ring"
          strokeWidth={0.05}
        />
      )}
      <MiniPips x={0} y={0} v={a} />
      <MiniPips x={1} y={0} v={b} />
    </svg>
  );
}

type Props = {
  dominoes: [number, number][];
  placed: boolean[];
  selected: number | null;
  selectedEnd?: 0 | 1 | null;
  disabled?: boolean;
  onPick: (d: number, end: 0 | 1) => void;
  /** Two-column bank on the right of a tall board. */
  side?: boolean;
  /** One-row, horizontally scrollable tile belt used by the mobile dock. */
  rail?: boolean;
};

export function PipsTray({
  dominoes,
  placed,
  selected,
  selectedEnd,
  disabled,
  onPick,
  side,
  rail,
}: Props) {
  const tray = useRef<HTMLDivElement>(null);

  // Available dominoes cluster together, lightest first; ones already on the
  // board drop to the end instead of leaving gaps in the middle of the bank.
  const order = useMemo(() => {
    return dominoes
      .map((_, d) => d)
      .sort((x, y) => {
        if (placed[x] !== placed[y]) return placed[x] ? 1 : -1;
        const sx = dominoes[x][0] + dominoes[x][1];
        const sy = dominoes[y][0] + dominoes[y][1];
        return sx - sy || x - y;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominoes, placed.join(",")]);

  useEffect(() => {
    if (!rail || selected == null) return;
    const host = tray.current;
    const item = host?.querySelector<HTMLElement>(`[data-domino="${selected}"]`);
    if (!host || !item) return;
    const left = item.offsetLeft;
    const right = left + item.offsetWidth;
    if (left < host.scrollLeft + 8)
      host.scrollTo({ left: Math.max(0, left - 8), behavior: "smooth" });
    else if (right > host.scrollLeft + host.clientWidth - 8) {
      host.scrollTo({ left: right - host.clientWidth + 8, behavior: "smooth" });
    }
  }, [rail, selected]);

  return (
    <div
      ref={tray}
      role="group"
      aria-label="Domino bank"
      className={cn(
        "grid gap-2",
        rail &&
          "tile-rail -mx-3 grid-flow-col auto-cols-[5.25rem] scroll-px-3 overflow-x-auto overscroll-x-contain px-3 py-1 [scroll-snap-type:x_proximity] [touch-action:pan-x]",
        !rail &&
          (side
            ? "grid-cols-4 sm:grid-cols-5 md:grid-cols-2"
            : "grid-cols-4 sm:grid-cols-5 md:grid-cols-7"),
      )}
    >
      {order.map((d) => {
        const [a, b] = dominoes[d];
        // A placed domino always reads as "on the board" in the tray, even
        // while it's selected there (to move/rotate it) — re-lighting the
        // slot made it look like a second, available copy of that domino.
        const onBoard = placed[d];
        const isSel = selected === d && !onBoard;
        const suffix = onBoard ? ", on the board — tap to pick it up" : "";
        return (
          <div
            key={d}
            data-domino={d}
            className={cn(
              "relative min-h-[2.75rem] rounded-[var(--radius-md)] p-1.5",
              rail && "snap-start",
              onBoard && "opacity-55",
              isSel && "bg-muted",
            )}
          >
            <MiniTile a={a} b={b} end={isSel ? (selectedEnd ?? null) : null} />
            <button
              type="button"
              aria-label={`Domino ${a}-${b}, ${a} pip${suffix}`}
              aria-pressed={isSel && selectedEnd === 0}
              disabled={disabled}
              onClick={() => onPick(d, 0)}
              className={cn(
                "absolute inset-y-0 left-0 w-1/2 rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            />
            <button
              type="button"
              aria-label={`Domino ${a}-${b}, ${b} pip${suffix}`}
              aria-pressed={isSel && selectedEnd === 1}
              disabled={disabled}
              onClick={() => onPick(d, 1)}
              className={cn(
                "absolute inset-y-0 right-0 w-1/2 rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
