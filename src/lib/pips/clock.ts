/** Active play time. Reading it has no side effects, including while paused. */
export function createClock() {
  let elapsed = 0;
  let started: number | null = null;
  return {
    read(now: number) {
      return Math.round(elapsed + (started === null ? 0 : Math.max(0, now - started)));
    },
    start(now: number) {
      if (started === null) started = now;
    },
    stop(now: number) {
      if (started !== null) {
        elapsed += Math.max(0, now - started);
        started = null;
      }
    },
    restore(ms: number) {
      elapsed = ms;
    },
  };
}
export type PlayClock = ReturnType<typeof createClock>;
