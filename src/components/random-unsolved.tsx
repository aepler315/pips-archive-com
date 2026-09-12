import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { prefetchDay } from "@/lib/pips/days";
import { pickRandomUnsolved, resultsMapFromStorage } from "@/lib/pips/random";
import type { Level } from "@/lib/pips/engine";
import type { IndexEntry } from "@/lib/pips/types";
import { cn } from "@/lib/utils";

export { resultKeyOf, resultsMapFromStorage, pickRandomUnsolved } from "@/lib/pips/random";

export function RandomUnsolved({
  puzzles,
  results,
  exclude,
  className,
}: {
  puzzles: IndexEntry[];
  /** Snapshot used for the first paint; a click always re-reads storage. */
  results: Map<string, unknown>;
  exclude?: { date: string; level: Level };
  className?: string;
}) {
  const navigate = useNavigate();
  const [none, setNone] = useState(false);
  if (none) {
    return (
      <span className={cn(buttonVariants({ variant: "secondary" }), "h-9 opacity-40 sm:h-10", className)}>
        All solved
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "secondary" }), "h-9 px-3.5 sm:h-10 sm:px-4", className)}
      onClick={() => {
        const live = resultsMapFromStorage();
        const pick = pickRandomUnsolved(puzzles, live.size ? live : results, exclude);
        if (!pick) {
          setNone(true);
          return;
        }
        prefetchDay(pick[0]);
        void navigate({
          to: "/play/$date/$level",
          params: { date: pick[0], level: pick[1] },
          search: { from: "random" },
        });
      }}
    >
      Random unsolved
    </button>
  );
}
