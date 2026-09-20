import assert from "node:assert/strict";
import test from "node:test";
import { recordSolve, exportAll, importAll, eraseAll, allResults } from "./store";
import { ensurePerformance, readAnalytics, ANALYTICS_KEY } from "./performance-store";
class MemoryStorage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
}

async function withStorage(run: (storage: MemoryStorage) => void | Promise<void>) {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const storage = new MemoryStorage();
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let queue = Promise.resolve();
  const locks = {
    request: (_name: string, run: () => unknown) => {
      const result = queue.then(run);
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks } });
  Object.assign(globalThis, { window: {}, localStorage: storage });
  try {
    await run(storage);
  } finally {
    Object.assign(globalThis, { window: originalWindow, localStorage: originalStorage });
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete (globalThis as { navigator?: Navigator }).navigator;
  }
}

test("baseline and context survive backup, existing anchors win, erase removes all analytics", () =>
  withStorage(async () => {
    for (let i = 1; i <= 10; i++)
      await recordSolve(`2026-01-${String(i).padStart(2, "0")}`, "easy", 120000, "a".repeat(64));
    await ensurePerformance();
    const before = readAnalytics(allResults())!;
    assert.equal(before.baseline.levels.easy?.anchor.length, 10);
    assert.equal(before.contexts.length, 10);
    const backup = exportAll();
    assert.ok(JSON.parse(backup).analytics);
    await recordSolve("2026-01-01", "easy", 1, "b".repeat(64));
    assert.deepEqual(readAnalytics(allResults()), before);
    await eraseAll();
    assert.equal(readAnalytics(allResults()), null);
    const report = await importAll(backup);
    assert.equal(report.analytics, "imported");
    assert.deepEqual(readAnalytics(allResults()), before);
    const bad = JSON.parse(backup);
    bad.analytics.baseline.levels.easy.anchor[0].first = 1;
    await eraseAll();
    const rejected = await importAll(JSON.stringify(bad));
    assert.equal(rejected.imported, 10);
    assert.equal(rejected.analytics, "rejected");
    await ensurePerformance();
    assert.equal(readAnalytics(allResults()), null);
  }));
test("analytics quota failure never changes successful immutable saves", () =>
  withStorage(async (storage) => {
    const set = storage.setItem.bind(storage);
    storage.setItem = (k, v) => {
      if (k === ANALYTICS_KEY) throw new Error("quota");
      set(k, v);
    };
    assert.equal((await recordSolve("2026-01-01", "easy", 123, "a".repeat(64))).status, "created");
    assert.equal(allResults()[0].first, 123);
  }));
