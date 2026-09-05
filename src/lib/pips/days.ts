import type { RawDay } from "./engine";

const cache = new Map<string, RawDay>();
const inflight = new Map<string, Promise<RawDay | undefined>>();

export function prefetchDay(date: string) {
  if (typeof window === "undefined") return;
  void loadDay(date);
}

export async function loadDay(date: string): Promise<RawDay | undefined> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const hit = cache.get(date);
  if (hit) return hit;
  const pending = inflight.get(date);
  if (pending) return pending;
  const job = readDay(date).finally(() => inflight.delete(date));
  inflight.set(date, job);
  return job;
}

async function readDay(date: string): Promise<RawDay | undefined> {
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
      if (!text) return undefined;
      data = JSON.parse(text) as RawDay;
    } else {
      const r = await fetch(`/data/puzzles/${date}.json`);
      if (!r.ok) return undefined;
      data = (await r.json()) as RawDay;
    }
    if (!data?.easy) return undefined;
    cache.set(date, data);
    return data;
  } catch {
    return undefined;
  }
}
