import { useEffect, useState } from "react";
import type { PlayClock as Clock } from "@/lib/pips/clock";
import { fmt } from "@/lib/pips/store";
import { cn } from "@/lib/utils";

/** Keep clock ticks out of the board's render tree. Shows the scored time: play plus hints. */
export function PlayClock({
  clock,
  stopped,
  penaltyMs = 0,
}: {
  clock: Clock;
  stopped: boolean;
  penaltyMs?: number;
}) {
  const [ms, setMs] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => setMs(clock.read(performance.now()));
    const visibility = () => {
      clearInterval(timer);
      timer = undefined;
      setPaused(document.hidden || stopped);
      update();
      if (!document.hidden && !stopped) timer = setInterval(update, 1000);
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", visibility);
    };
  }, [clock, stopped]);
  return (
    <div className="flex flex-col items-end">
      <div
        className={cn(
          "min-w-[4.5ch] text-right font-medium text-[1.35rem] tabular-nums",
          paused && "text-muted-foreground",
        )}
      >
        {fmt(ms + penaltyMs)}
      </div>
      {penaltyMs > 0 ? (
        <span className="-mt-0.5 text-[0.7rem] leading-none text-muted-foreground tabular-nums">
          incl. +{fmt(penaltyMs)} hints
        </span>
      ) : null}
    </div>
  );
}
