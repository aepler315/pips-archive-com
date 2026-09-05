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

function MiniTile({ a, b }: { a: number; b: number }) {
  return (
    <svg viewBox="0 0 2 1" className="pointer-events-none block h-auto w-full">
      <rect x={0.08} y={0.08} width={1.84} height={0.84} rx={0.16} className="fill-card stroke-foreground" strokeWidth={0.05} />
      <line x1={1} y1={0.2} x2={1} y2={0.8} className="stroke-foreground/35" strokeWidth={0.035} />
      <MiniPips x={0} y={0} v={a} />
      <MiniPips x={1} y={0} v={b} />
    </svg>
  );
}

type Props = {
  dominoes: [number, number][];
  placed: boolean[];
  selected: number | null;
  disabled?: boolean;
  onPick: (d: number) => void;
  /** Two-column bank on the right of a tall board. */
  side?: boolean;
};

export function PipsTray({ dominoes, placed, selected, disabled, onPick, side }: Props) {
  return (
    <div
      className={cn(
        "grid gap-2",
        side ? "grid-cols-4 sm:grid-cols-5 md:grid-cols-2" : "grid-cols-4 sm:grid-cols-5 md:grid-cols-7",
      )}
    >
      {dominoes.map(([a, b], d) => (
        <button
          key={d}
          type="button"
          aria-label={`Domino ${a}-${b}`}
          aria-pressed={selected === d}
          disabled={disabled}
          onClick={() => onPick(d)}
          className={cn(
            "rounded-[var(--radius-md)] p-1.5 transition-transform duration-[var(--motion-quick)] ease-[var(--ease-out)]",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            placed[d] && selected !== d && "opacity-30",
            selected === d && "bg-muted ring-2 ring-ring",
          )}
        >
          <MiniTile a={a} b={b} />
        </button>
      ))}
    </div>
  );
}
