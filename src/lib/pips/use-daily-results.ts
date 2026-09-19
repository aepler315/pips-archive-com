import { useEffect, useMemo, useState } from "react";
import { LEVELS } from "./engine";
import { allResults, getResult, subscribeResults } from "./store";
import { buildDailyResults } from "./daily-results";

/** Initial render is identical on server and client; only effects read storage. */
export function useDailyResults(date: string) {
  const [snapshot, setSnapshot] = useState<ReturnType<typeof buildDailyResults> | null>(null);
  useEffect(() => {
    const refresh = () =>
      setSnapshot(
        buildDailyResults(date, {
          easy: getResult(date, LEVELS[0]),
          medium: getResult(date, LEVELS[1]),
          hard: getResult(date, LEVELS[2]),
        }),
      );
    const unsubscribe = subscribeResults(refresh);
    refresh();
    return unsubscribe;
  }, [date]);
  const summary = snapshot?.date === date ? snapshot : null;
  return { ready: summary !== null, summary };
}
export function useAllResults() {
  const [snapshot, setSnapshot] = useState<ReturnType<typeof allResults> | null>(null);
  useEffect(() => {
    const refresh = () => setSnapshot(allResults());
    const unsubscribe = subscribeResults(refresh);
    refresh();
    return unsubscribe;
  }, []);
  return useMemo(() => ({ ready: snapshot !== null, results: snapshot ?? [] }), [snapshot]);
}
