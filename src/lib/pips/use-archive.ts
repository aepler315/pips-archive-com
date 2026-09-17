import { useEffect, useSyncExternalStore } from "react";
import initial from "@/data/archive.json";
import { archiveIsBehind, createArchiveStore } from "./archive";

const store = createArchiveStore(initial);
let lastAttempt = 0;
function refresh() {
  if (document.hidden || Date.now() - lastAttempt < 30_000) return;
  lastAttempt = Date.now();
  void store.refresh();
}

export function useArchiveIndex() {
  const index = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      // No network polling once today's puzzle is present. The date check also
      // notices midnight in an already-open foreground tab.
      if (archiveIsBehind(store.getSnapshot(), new Date())) refresh();
    }, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return index;
}
