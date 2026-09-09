export type BoardOrientation = "natural" | "clockwise";

const WIDE_TURN_RATIO = 1.75;
const MIN_TURN_COLUMNS = 7;
const MOBILE_HEIGHT_FRACTION = 0.72;
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

/** Prevent very narrow boards from becoming metre-long scroll monuments while
 * still allowing roughly finger-sized cells on ordinary phone viewports. */
export function mobileBoardMaxHeight(viewportHeight: number, displayedRows: number): number {
  return Math.round(
    Math.min(
      viewportHeight * MOBILE_HEIGHT_FRACTION,
      (displayedRows + BOARD_PADDING_UNITS) * IDEAL_CELL_PX,
    ),
  );
}
