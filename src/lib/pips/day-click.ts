export type DayClickTarget =
  | { kind: "play"; date: string; level: "easy" }
  | { kind: "dialog"; date: string };

/** An untouched day should open Easy immediately. Any recorded solve keeps
 *  the difficulty picker so the player can jump to a specific board. */
export function dayClickTarget(date: string, solvedCount: number): DayClickTarget {
  if (solvedCount > 0) return { kind: "dialog", date };
  return { kind: "play", date, level: "easy" };
}
