import type { RawDay } from "./engine";

const cache = new Map<string, RawDay>();
const inflight = new Map<string, Promise<DayLoad>>();

export type DayLoad = { kind: "ok"; day: RawDay } | { kind: "missing" } | { kind: "error" };

export function prefetchDay(date: string) {
  if (typeof window === "undefined") return;
  void loadDay(date);
}

export async function loadDay(date: string): Promise<DayLoad> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: "missing" };
  const hit = cache.get(date);
  if (hit) return { kind: "ok", day: hit };
  const pending = inflight.get(date);
  if (pending) return pending;
  const job = readDay(date).finally(() => inflight.delete(date));
  inflight.set(date, job);
  return job;
}

async function readDay(date: string): Promise<DayLoad> {
  try {
    let data: RawDay | undefined;
    if (typeof window === "undefined") {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const files = [
        join(process.cwd(), "public/data/puzzles", `${date}.json`),
        join(process.cwd(), "data/puzzles", `${date}.json`),
      ];
      let text: string | undefined;
      for (const file of files) {
        try {
          text = await readFile(file, "utf8");
          break;
        } catch {
          /* try next */
        }
      }
      if (!text) return { kind: "missing" };
      data = JSON.parse(text) as RawDay;
    } else {
      const r = await fetch(`/data/puzzles/${date}.json`);
      if (r.status === 404) return { kind: "missing" };
      if (!r.ok) return { kind: "error" };
      data = (await r.json()) as RawDay;
    }
    if (!data?.easy) return { kind: "error" };
    cache.set(date, data);
    return { kind: "ok", day: data };
  } catch {
    return { kind: "error" };
  }
}
