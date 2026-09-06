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
};

export function PipsTray({
  dominoes,
  placed,
  selected,
  selectedEnd,
  disabled,
  onPick,
  side,
}: Props) {
  return (
    <div
      className={cn(
        "grid gap-2",
        side ? "grid-cols-4 sm:grid-cols-5 md:grid-cols-2" : "grid-cols-4 sm:grid-cols-5 md:grid-cols-7",
      )}
    >
      {dominoes.map(([a, b], d) => (
        <div
          key={d}
          className={cn(
            "relative min-h-[2.75rem] rounded-[var(--radius-md)] p-1.5",
            placed[d] && selected !== d && "opacity-30",
            selected === d && "bg-muted",
          )}
        >
          <MiniTile a={a} b={b} end={selected === d ? (selectedEnd ?? null) : null} />
          <button
            type="button"
            aria-label={`Domino ${a}-${b}, ${a} pip`}
            aria-pressed={selected === d && selectedEnd === 0}
            disabled={disabled}
            onClick={() => onPick(d, 0)}
            className="absolute inset-y-0 left-0 w-1/2 rounded-l-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            aria-label={`Domino ${a}-${b}, ${b} pip`}
            aria-pressed={selected === d && selectedEnd === 1}
            disabled={disabled}
            onClick={() => onPick(d, 1)}
            className="absolute inset-y-0 right-0 w-1/2 rounded-r-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ))}
    </div>
  );
}
