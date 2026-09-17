import { useEffect, useState } from "react";
import type { PlayClock as Clock } from "@/lib/pips/clock";
import { fmt } from "@/lib/pips/store";
import { cn } from "@/lib/utils";

/** Keep clock ticks out of the board's render tree. */
export function PlayClock({ clock, stopped }: { clock: Clock; stopped: boolean }) {
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
    <div
      className={cn(
        "min-w-[4.5ch] text-right font-medium text-[1.35rem] tabular-nums",
        paused && "text-muted-foreground",
      )}
    >
      {fmt(ms)}
    </div>
  );
}
