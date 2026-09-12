import { useId, useRef, useState } from "react";
import type { Cell, GameState, Puzzle, RegionStatus } from "@/lib/pips/engine";
import { key, labelText, occupancy, regionDescription, snapPlacement } from "@/lib/pips/engine";
import { colorRegions, swatchFor, type Swatch } from "@/lib/pips/colors";
import type { BoardOrientation } from "@/lib/pips/layout";
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

// Uniform shrink for constraint badges. At 1 they span a full cell
// diagonally and sit on the corner pip; scaled down they clear it
// (pips sit 0.28 units in from the badge anchor, the scaled diamond
// only reaches ~0.15).
const BADGE_SCALE = 0.66;

type Props = {
  puzzle: Puzzle;
  state: GameState;
  statuses: RegionStatus[];
  sel: Sel;
  hold?: number | null;
  holdEnd?: 0 | 1;
  pending?: { cell: Cell; pip: number } | null;
  orientation?: BoardOrientation;
  onCell: (cell: Cell) => void;
  onBackground: () => void;
};

function cellAtPointer(
  space: SVGGraphicsElement | null,
  clientX: number,
  clientY: number,
): Cell | null {
  // Convert through the board group's actual screen matrix instead of
  // manually recreating preserveAspectRatio math. Besides being more exact,
  // this also inverts the optional quarter-turn used for wide mobile boards.
  const svg = space?.ownerSVGElement;
  const matrix = space?.getScreenCTM();
  if (!svg || !matrix) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const local = point.matrixTransform(matrix.inverse());
  return [Math.floor(local.y), Math.floor(local.x)];
}

function Pips({ x, y, v, ghost = false }: { x: number; y: number; v: number; ghost?: boolean }) {
  return (
    <g>
      {(PIP_LAYOUT[v] ?? []).map(([px, py], i) => (
        <circle
          key={i}
          cx={x + px}
          cy={y + py}
          r={ghost ? 0.075 : 0.09}
          className={ghost ? "fill-none stroke-foreground/70" : "fill-foreground"}
          strokeWidth={ghost ? 0.045 : undefined}
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
    <g className="pointer-events-none">
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={0.18}
        fill={ghost ? "white" : undefined}
        fillOpacity={ghost ? 0.18 : undefined}
        className={
          ghost
            ? "stroke-foreground/55"
            : selected
              ? "fill-card stroke-ring"
              : "fill-card stroke-foreground/80"
        }
        strokeWidth={ghost || selected ? 0.055 : 0.04}
        strokeDasharray={ghost ? "0.12 0.08" : undefined}
      />
      {horiz ? (
        <line
          x1={mx}
          y1={y + 0.12}
          x2={mx}
          y2={y + h - 0.12}
          className="stroke-foreground/30"
          strokeWidth={0.03}
        />
      ) : (
        <line
          x1={x + 0.12}
          y1={my}
          x2={x + w - 0.12}
          y2={my}
          className="stroke-foreground/30"
          strokeWidth={0.03}
        />
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
        fill="white"
        fillOpacity={0.18}
        className="stroke-foreground/55"
        strokeWidth={0.055}
        strokeDasharray="0.12 0.08"
      />
      <Pips x={c} y={r} v={pip} ghost />
    </g>
  );
}

function Badge({
  x,
  y,
  text,
  description,
  swatch,
  status,
  filterId,
  counterRotate,
}: {
  x: number;
  y: number;
  text: string;
  description: string;
  swatch: Swatch;
  status: RegionStatus;
  filterId: string;
  counterRotate?: boolean;
}) {
  const s = Math.max(0.7, 0.5 + 0.11 * text.length);
  return (
    // Shrunken as a whole (diamond, stroke and text scale together) around
    // the corner anchor, so it stays tucked into the same spot while
    // covering less of the tile's pips.
    <g
      transform={`translate(${x},${y}) ${counterRotate ? "rotate(-90) " : ""}scale(${BADGE_SCALE})`}
      className="pointer-events-none"
    >
      <rect
        x={-s / 2}
        y={-s / 2}
        width={s}
        height={s}
        rx={s * 0.18}
        transform="rotate(45)"
        fill={swatch.badge}
        stroke={status === "violated" ? "var(--color-bad-ink)" : "rgba(255,255,255,0.45)"}
        strokeWidth={status === "violated" ? 0.09 : 0.035}
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
      <title>{status === "violated" ? `Broken: ${description}` : description}</title>
    </g>
  );
}

export function PipsBoard({
  puzzle,
  state,
  statuses,
  sel,
  hold,
  holdEnd = 0,
  pending,
  orientation = "natural",
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
  const turned = orientation === "clockwise";
  const displayViewBox = turned ? `0 0 ${vbH} ${vbW}` : `${vbX} ${vbY} ${vbW} ${vbH}`;
  const boardTransform = turned
    ? `translate(${vbH} 0) rotate(90) translate(${-vbX} ${-vbY})`
    : undefined;
  const [hover, setHover] = useState<Cell | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; holding: boolean } | null>(null);
  const boardSpace = useRef<SVGGElement>(null);
  const snap =
    hold != null && hover
      ? snapPlacement(puzzle, state, hold, hover, pending?.cell ?? null, holdEnd)
      : null;
  const ghost = hold != null ? (snap?.[hold] ?? null) : null;
  const ghostOcc = snap ? occupancy(puzzle, snap) : null;

  const cellFrom = (_svg: SVGSVGElement, clientX: number, clientY: number) => {
    const cell = cellAtPointer(boardSpace.current, clientX, clientY);
    if (!cell) return null;
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
      viewBox={displayViewBox}
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
        setHover(null);
        if (!d.holding && moved > 14 && cell) return;
        if (cell) onCell(cell);
        else onBackground();
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
        {/* A violated region gets this hatch on top of its fill so the
            signal doesn't rely on a color shift alone — some swatches
            barely change color when tinted "broken". */}
        <pattern
          id={`${uid}-hatch`}
          width={0.16}
          height={0.16}
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={0.16}
            stroke="var(--color-bad-ink)"
            strokeWidth={0.05}
            strokeOpacity={0.5}
          />
        </pattern>
      </defs>

      <g ref={boardSpace} transform={boardTransform}>
        <rect
          x={vbX}
          y={vbY}
          width={vbW}
          height={vbH}
          fill="var(--color-grout)"
          pointerEvents="all"
        />

        {puzzle.regions.map((reg, i) => {
          const sw = swatchFor(assigned, i);
          const st = statuses[i];
          let fill = sw.fill;
          if (st === "violated") fill = `color-mix(in oklab, #e8b0a8 45%, ${sw.fill})`;
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
              {st === "violated" && <path d={d} fill={`url(#${uid}-hatch)`} />}
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

        {ghost && ghostOcc ? (
          <Tile
            c1={ghost.cells[0]}
            c2={ghost.cells[1]}
            a={ghostOcc.get(key(...ghost.cells[0]))?.pip ?? puzzle.dominoes[hold!][0]}
            b={ghostOcc.get(key(...ghost.cells[1]))?.pip ?? puzzle.dominoes[hold!][1]}
            ghost
          />
        ) : hover && hold != null && !pending ? (
          <HalfTile cell={hover} pip={puzzle.dominoes[hold][holdEnd]} />
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
              x={pos.x}
              y={pos.y}
              text={t}
              description={regionDescription(reg)}
              swatch={sw}
              status={statuses[i]}
              filterId={`${uid}-badge`}
              counterRotate={turned}
            />
          );
        })}
      </g>
    </svg>
  );
}
