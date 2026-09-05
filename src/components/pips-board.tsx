import { useId, useRef, useState } from "react";
import type { Cell, GameState, Puzzle, RegionStatus } from "@/lib/pips/engine";
import { key, labelText, snapPlacement } from "@/lib/pips/engine";
import { colorRegions, swatchFor, type Swatch } from "@/lib/pips/colors";
import {
  BOARD,
  PIP_LAYOUT,
  badgeAnchor,
  boundsOf,
  puzzleCells,
  regionDividers,
  unionPath,
} from "@/lib/pips/geometry";

type Sel = { kind: "tray" | "board"; d: number } | null;

type Props = {
  puzzle: Puzzle;
  state: GameState;
  statuses: RegionStatus[];
  sel: Sel;
  hold?: number | null;
  pending?: { cell: Cell; pip: number } | null;
  onCell: (cell: Cell) => void;
  onBackground: () => void;
};

function cellAtPointer(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  vb: { x: number; y: number; w: number; h: number },
): Cell {
  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width / vb.w, rect.height / vb.h);
  const ox = rect.left + (rect.width - vb.w * scale) / 2;
  const oy = rect.top + (rect.height - vb.h * scale) / 2;
  return [Math.floor((clientY - oy) / scale + vb.y), Math.floor((clientX - ox) / scale + vb.x)];
}

function Pips({ x, y, v, ghost = false }: { x: number; y: number; v: number; ghost?: boolean }) {
  return (
    <g>
      {(PIP_LAYOUT[v] ?? []).map(([px, py], i) => (
        <circle
          key={i}
          cx={x + px}
          cy={y + py}
          r={0.09}
          className={ghost ? "fill-foreground/30" : "fill-foreground"}
        />
      ))}
    </g>
  );
}

function Tile({
  c1,
  c2,
  a,
  b,
  selected,
  ghost,
}: {
  c1: Cell;
  c2: Cell;
  a: number;
  b: number;
  selected?: boolean;
  ghost?: boolean;
}) {
  const [r1, col1] = c1;
  const [r2, col2] = c2;
  const inset = 0.14;
  const x = Math.min(col1, col2) + inset;
  const y = Math.min(r1, r2) + inset;
  const w = (col1 === col2 ? 1 : 2) - inset * 2;
  const h = (r1 === r2 ? 1 : 2) - inset * 2;
  const mx = (col1 + col2) / 2 + 0.5;
  const my = (r1 + r2) / 2 + 0.5;
  const horiz = r1 === r2;
  return (
    <g className={ghost ? "pointer-events-none opacity-55" : "pointer-events-none"}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={0.18}
        className={
          ghost
            ? "fill-card stroke-ring"
            : selected
              ? "fill-card stroke-ring"
              : "fill-card stroke-foreground/80"
        }
        strokeWidth={ghost || selected ? 0.06 : 0.04}
        strokeDasharray={ghost ? "0.1 0.07" : undefined}
      />
      {horiz ? (
        <line x1={mx} y1={y + 0.12} x2={mx} y2={y + h - 0.12} className="stroke-foreground/30" strokeWidth={0.03} />
      ) : (
        <line x1={x + 0.12} y1={my} x2={x + w - 0.12} y2={my} className="stroke-foreground/30" strokeWidth={0.03} />
      )}
      <Pips x={col1} y={r1} v={a} ghost={ghost} />
      <Pips x={col2} y={r2} v={b} ghost={ghost} />
    </g>
  );
}

function HalfTile({ cell, pip }: { cell: Cell; pip: number }) {
  const [r, c] = cell;
  const inset = 0.14;
  return (
    <g className="pointer-events-none">
      <rect
        x={c + inset}
        y={r + inset}
        width={1 - inset * 2}
        height={1 - inset * 2}
        rx={0.18}
        className="fill-card stroke-ring"
        strokeWidth={0.06}
      />
      <Pips x={c} y={r} v={pip} />
    </g>
  );
}

function Badge({
  regionId,
  x,
  y,
  text,
  swatch,
  status,
  filterId,
}: {
  regionId: number;
  x: number;
  y: number;
  text: string;
  swatch: Swatch;
  status: RegionStatus;
  filterId: string;
}) {
  const s = Math.max(0.7, 0.5 + 0.11 * text.length);
  return (
    <g transform={`translate(${x},${y})`} className="pointer-events-none">
      <rect
        x={-s / 2}
        y={-s / 2}
        width={s}
        height={s}
        rx={s * 0.18}
        transform="rotate(45)"
        fill={swatch.badge}
        stroke={status === "violated" ? "var(--color-bad-ink)" : "rgba(255,255,255,0.45)"}
        strokeWidth={0.035}
        filter={`url(#${filterId})`}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={text.length > 2 ? 0.22 : 0.28}
        fontWeight={700}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {text}
      </text>
      <title>{`Region ${regionId}: ${text}`}</title>
    </g>
  );
}

export function PipsBoard({
  puzzle,
  state,
  statuses,
  sel,
  hold,
  pending,
  onCell,
  onBackground,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const cells = puzzleCells(puzzle);
  const b = boundsOf(cells);
  const assigned = colorRegions(puzzle);
  const pad = 0.7;
  const vbX = b.minC - pad;
  const vbY = b.minR - pad;
  const vbW = b.maxC + 1 - b.minC + pad * 2;
  const vbH = b.maxR + 1 - b.minR + pad * 2;
  const vb = { x: vbX, y: vbY, w: vbW, h: vbH };
  const [hover, setHover] = useState<Cell | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; holding: boolean } | null>(null);
  const snap =
    hold != null && hover
      ? snapPlacement(puzzle, state, hold, hover, pending?.cell ?? null)
      : null;
  const ghost = hold != null ? snap?.[hold] ?? null : null;

  const cellFrom = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const cell = cellAtPointer(svg, clientX, clientY, vb);
    return puzzle.cells.has(key(...cell)) ? cell : null;
  };

  const follow = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    if (hold == null) {
      if (hover) setHover(null);
      return;
    }
    const cell = cellFrom(svg, clientX, clientY);
    if (!cell) {
      if (hover) setHover(null);
      return;
    }
    if (!hover || key(...hover) !== key(...cell)) setHover(cell);
  };

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className="board-svg select-none"
      role="img"
      aria-label="Pips board"
      onPointerMove={(e) => {
        const dragging = drag.current?.id === e.pointerId;
        const mouseHover = e.pointerType !== "touch" && e.buttons === 0 && !dragging;
        if (hold == null && !dragging) {
          if (hover) setHover(null);
          return;
        }
        if (mouseHover || (dragging && hold != null)) {
          follow(e.currentTarget, e.clientX, e.clientY);
        }
      }}
      onPointerLeave={() => {
        if (drag.current) return;
        if (hover) setHover(null);
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, holding: hold != null };
        if (hold != null) follow(e.currentTarget, e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (drag.current?.id !== e.pointerId) return;
        const d = drag.current;
        drag.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
        const cell = cellFrom(e.currentTarget, e.clientX, e.clientY);
        if (d.holding) {
          if (cell) onCell(cell);
          else onBackground();
          setHover(null);
          return;
        }
        if (moved > 14) {
          setHover(null);
          return;
        }
        if (cell) onCell(cell);
        else onBackground();
        setHover(null);
      }}
      onPointerCancel={(e) => {
        if (drag.current?.id !== e.pointerId) return;
        drag.current = null;
        setHover(null);
      }}
    >
      <defs>
        <filter id={`${uid}-shadow`} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="0.035" stdDeviation="0.03" floodOpacity="0.16" />
        </filter>
        <filter id={`${uid}-badge`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="0.03" stdDeviation="0.025" floodOpacity="0.28" />
        </filter>
      </defs>

      {puzzle.regions.map((reg, i) => {
        const sw = swatchFor(assigned, i);
        const st = statuses[i];
        const isAnchor = pending ? reg.cells.some((c) => key(...c) === key(...pending.cell)) : false;
        let fill = sw.fill;
        if (st === "violated") fill = `color-mix(in oklab, #e8b0a8 45%, ${sw.fill})`;
        if (isAnchor) fill = `color-mix(in oklab, #e8c36a 40%, ${sw.fill})`;
        const d = unionPath(reg.cells, BOARD.radius, BOARD.inset);
        const divs = regionDividers(reg.cells, BOARD.inset, BOARD.dividerPad);
        return (
          <g key={`r${i}`} className="pointer-events-none" filter={`url(#${uid}-shadow)`}>
            <path
              d={d}
              fill={fill}
              stroke={sw.dash}
              strokeWidth={BOARD.stroke}
              strokeDasharray={BOARD.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {divs.map((s, j) => (
              <line
                key={j}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={sw.dash}
                strokeWidth={BOARD.innerStroke}
                strokeDasharray={BOARD.innerDash}
                strokeLinecap="round"
              />
            ))}
          </g>
        );
      })}

      {state.map((p, d) => {
        if (!p) return null;
        const [a, bPip] = puzzle.dominoes[d];
        return (
          <Tile
            key={`t${d}`}
            c1={p.cells[0]}
            c2={p.cells[1]}
            a={a}
            b={bPip}
            selected={sel?.kind === "board" && sel.d === d}
          />
        );
      })}

      {ghost ? (
        <Tile
          c1={ghost.cells[0]}
          c2={ghost.cells[1]}
          a={puzzle.dominoes[hold!][0]}
          b={puzzle.dominoes[hold!][1]}
          ghost
        />
      ) : pending ? (
        <HalfTile cell={pending.cell} pip={pending.pip} />
      ) : null}

      {puzzle.regions.map((reg, i) => {
        const t = labelText(reg);
        if (!t) return null;
        const sw = swatchFor(assigned, i);
        const pos = badgeAnchor(reg);
        return (
          <Badge
            key={`b${i}`}
            regionId={i}
            x={pos.x}
            y={pos.y}
            text={t}
            swatch={sw}
            status={statuses[i]}
            filterId={`${uid}-badge`}
          />
        );
      })}
    </svg>
  );
}
