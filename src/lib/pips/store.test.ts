import assert from "node:assert/strict";
import { test } from "node:test";
import { allResults, exportAll, getProgress, importAll, saveProgress } from "./store.ts";

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

function withStorage(run: (storage: MemoryStorage) => void) {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const storage = new MemoryStorage();
  Object.assign(globalThis, { window: {}, localStorage: storage });
  try {
    run(storage);
  } finally {
    Object.assign(globalThis, { window: originalWindow, localStorage: originalStorage });
  }
}

test("import restores an unfinished board included in an archive backup", () => {
  withStorage(() => {
    saveProgress("2026-09-11", "hard", [{ cells: [[0, 0], [0, 1]] }], 12_345);
    const backup = exportAll();
    const { imported, progress, skipped } = importAll(backup);
    assert.deepEqual({ imported, progress, skipped }, { imported: 0, progress: 1, skipped: 0 });
    assert.deepEqual(getProgress("2026-09-11", "hard"), {
      state: [{ cells: [[0, 0], [0, 1]] }],
      elapsed: 12_345,
    });
  });
});

test("allResults treats denied browser storage as an empty archive", () => {
  const originalWindow = globalThis.window;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.assign(globalThis, { window: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Storage access denied");
    },
  });
  try {
    assert.deepEqual(allResults(), []);
  } finally {
    Object.assign(globalThis, { window: originalWindow });
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});
