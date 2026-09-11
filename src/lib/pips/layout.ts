export type BoardOrientation = "natural" | "clockwise";

const WIDE_TURN_RATIO = 1.75;
const MIN_TURN_COLUMNS = 7;
const IDEAL_CELL_PX = 56;
const BOARD_PADDING_UNITS = 1.4;

/** Wide boards gain substantially larger touch targets when their long axis
 * follows a portrait phone's long axis. Less-extreme boards stay canonical. */
export function mobileBoardOrientation(rows: number, cols: number): BoardOrientation {
  return cols >= MIN_TURN_COLUMNS && cols / Math.max(rows, 1) >= WIDE_TURN_RATIO
    ? "clockwise"
    : "natural";
}

export function displayedGrid(
  rows: number,
  cols: number,
  orientation: BoardOrientation,
): { rows: number; cols: number } {
  return orientation === "clockwise" ? { rows: cols, cols: rows } : { rows, cols };
}

/** Size cells for comfortable tapping rather than shrinking a tall board to
 * fit one screen — the page scrolls instead of cramming everything in. */
export function mobileBoardMaxHeight(displayedRows: number): number {
  return Math.round((displayedRows + BOARD_PADDING_UNITS) * IDEAL_CELL_PX);
}
