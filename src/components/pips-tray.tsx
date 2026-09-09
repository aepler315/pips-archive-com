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

function MiniTile({
  a,
  b,
  end,
  vertical,
}: {
  a: number;
  b: number;
  end?: 0 | 1 | null;
  /** Rotated 90° to stand tall and narrow, for a strip flanking the board. */
  vertical?: boolean;
}) {
  const svg = (
    <svg
      viewBox="0 0 2 1"
      className={cn("pointer-events-none block", vertical ? "h-full w-full" : "h-auto w-full")}
    >
      <rect x={0.08} y={0.08} width={1.84} height={0.84} rx={0.16} className="fill-card stroke-foreground" strokeWidth={0.05} />
      <line x1={1} y1={0.2} x2={1} y2={0.8} className="stroke-foreground/35" strokeWidth={0.035} />
      {end === 0 && (
        <rect x={0.1} y={0.1} width={0.86} height={0.8} rx={0.14} className="fill-ring/25 stroke-ring" strokeWidth={0.05} />
      )}
      {end === 1 && (
        <rect x={1.04} y={0.1} width={0.86} height={0.8} rx={0.14} className="fill-ring/25 stroke-ring" strokeWidth={0.05} />
      )}
      <MiniPips x={0} y={0} v={a} />
      <MiniPips x={1} y={0} v={b} />
    </svg>
  );
  if (!vertical) return svg;
  // The tile is drawn at its normal 2:1 aspect, then the whole thing is
  // rotated onto a 1:2 box: simpler and less error-prone than re-deriving
  // every pip coordinate for a portrait layout.
  return (
    <div className="relative aspect-[1/2] w-full">
      <div className="absolute top-1/2 left-1/2 aspect-[2/1] w-[200%] -translate-x-1/2 -translate-y-1/2 rotate-90">
        {svg}
      </div>
    </div>
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
  /** Single column of portrait tiles, for a strip flanking a tall board on a narrow screen. */
  vertical?: boolean;
  /** Render only these domino indices, in this order (default: all, in order). */
  indices?: number[];
};

export function PipsTray({
  dominoes,
  placed,
  selected,
  selectedEnd,
  disabled,
  onPick,
  side,
  vertical,
  indices,
}: Props) {
  const order = indices ?? dominoes.map((_, i) => i);
  return (
    <div
      className={cn(
        vertical ? "flex w-12 shrink-0 flex-col gap-2" : "grid gap-2",
        !vertical &&
          (side ? "grid-cols-4 sm:grid-cols-5 md:grid-cols-2" : "grid-cols-4 sm:grid-cols-5 md:grid-cols-7"),
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
            className={cn(
              "relative rounded-[var(--radius-md)] p-1.5",
              vertical ? "w-full" : "min-h-[2.75rem]",
              onBoard && "opacity-55",
              isSel && "bg-muted",
            )}
          >
            <MiniTile a={a} b={b} end={isSel ? (selectedEnd ?? null) : null} vertical={vertical} />
            <button
              type="button"
              aria-label={`Domino ${a}-${b}, ${a} pip${suffix}`}
              aria-pressed={isSel && selectedEnd === 0}
              disabled={disabled}
              onClick={() => onPick(d, 0)}
              className={cn(
                "absolute rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                vertical ? "inset-x-0 top-0 h-1/2" : "inset-y-0 left-0 w-1/2",
              )}
            />
            <button
              type="button"
              aria-label={`Domino ${a}-${b}, ${b} pip${suffix}`}
              aria-pressed={isSel && selectedEnd === 1}
              disabled={disabled}
              onClick={() => onPick(d, 1)}
              className={cn(
                "absolute rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                vertical ? "inset-x-0 bottom-0 h-1/2" : "inset-y-0 right-0 w-1/2",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
