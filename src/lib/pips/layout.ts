export type BoardOrientation = "natural" | "clockwise";

const MIN_TURN_COLUMNS = 7;
const IDEAL_CELL_PX = 56;
const BOARD_PADDING_UNITS = 0.8;

/** A board that is wider than tall gains larger touch targets when its long
 * axis follows a portrait phone's long axis. */
export function mobileBoardOrientation(rows: number, cols: number): BoardOrientation {
  return cols >= MIN_TURN_COLUMNS && cols - rows >= 2 ? "clockwise" : "natural";
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
