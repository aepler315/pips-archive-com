import { parsePuzzle } from "./engine";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allResults,
  exportAll,
  getProgress,
  importAll,
  saveProgress,
  recordSolve,
} from "./store.ts";

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

test("import restores an unfinished board included in an archive backup", () => {
  return withStorage(async () => {
    saveProgress(
      "2026-09-11",
      "hard",
      [
        {
          cells: [
            [0, 0],
            [0, 1],
          ],
        },
      ],
      12_345,
    );
    const backup = exportAll();
    const { imported, progress, skipped } = await importAll(backup);
    assert.deepEqual({ imported, progress, skipped }, { imported: 0, progress: 1, skipped: 0 });
    assert.deepEqual(getProgress("2026-09-11", "hard"), {
      state: [
        {
          cells: [
            [0, 0],
            [0, 1],
          ],
        },
      ],
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

const validResult = {
  first: 2000,
  best: 1000,
  plays: 2,
  solvedAt: "2026-09-14T00:00:00Z",
  lastAt: "2026-09-15T00:00:00Z",
};
const backup = (data: Record<string, unknown>) => JSON.stringify({ version: 1, data });

test("imported result fields cannot override the date and level from the key", () => {
  return withStorage(async () => {
    await importAll(
      backup({
        "pips-archive:v1:result:2026-09-14:easy": { ...validResult, date: 42, level: "bogus" },
        "pips-archive:v1:result:2026-09-15:easy": validResult,
      }),
    );
    assert.deepEqual(
      allResults().map(({ date, level }) => ({ date, level })),
      [
        { date: "2026-09-14", level: "easy" },
        { date: "2026-09-15", level: "easy" },
      ],
    );
  });
});
test("invalid result keys and invalid numeric or timestamp values are rejected", () => {
  return withStorage(async () => {
    const result = await importAll(
      backup({
        "pips-archive:v1:result:2026-02-30:easy": validResult,
        "pips-archive:v1:result:2026-09-14:bogus": validResult,
        "pips-archive:v1:result:2026-09-14:easy": { ...validResult, best: -1 },
        "pips-archive:v1:result:2026-09-15:easy": { ...validResult, plays: 1.5 },
        "pips-archive:v1:result:2026-09-16:easy": { ...validResult, lastAt: "yesterday" },
      }),
    );
    assert.equal(result.imported, 0);
    assert.equal(result.skipped, 5);
    assert.deepEqual(allResults(), []);
  });
});
test("reading corrupt existing records does not crash the archive", () => {
  return withStorage(async (storage) => {
    storage.setItem("pips-archive:v1:result:2026-09-14:easy", '{"date":42}');
    storage.setItem("pips-archive:v1:result:2026-09-15:easy", JSON.stringify(validResult));
    assert.equal(allResults().length, 1);
  });
});
test("imports reject overlapping and nonadjacent placements", () => {
  return withStorage(async () => {
    const result = await importAll(
      backup({
        "pips-archive:v1:progress:2026-09-14:easy": {
          elapsed: 10,
          state: [
            {
              cells: [
                [0, 0],
                [2, 0],
              ],
            },
          ],
        },
        "pips-archive:v1:progress:2026-09-15:easy": {
          elapsed: 10,
          state: [
            {
              cells: [
                [0, 0],
                [0, 1],
              ],
            },
            {
              cells: [
                [0, 0],
                [1, 0],
              ],
            },
          ],
        },
      }),
    );
    assert.equal(result.progress, 0);
    assert.equal(result.skipped, 2);
  });
});
test("quota failures are reported without claiming an import succeeded", () => {
  return withStorage(async (storage) => {
    storage.setItem = () => {
      throw new Error("quota");
    };
    const result = await importAll(
      backup({ "pips-archive:v1:result:2026-09-15:easy": validResult }),
    );
    assert.equal(result.imported, 0);
    assert.equal((result as { failed?: number }).failed, 1);
    assert.deepEqual(allResults(), []);
    assert.equal(saveProgress("2026-09-15", "easy", [null], 100), false);
  });
});

test("impossible timestamp dates are rejected instead of silently normalized", () => {
  return withStorage(async () => {
    const result = await importAll(
      backup({
        "pips-archive:v1:result:2026-09-15:easy": {
          ...validResult,
          solvedAt: "2026-02-30T00:00:00Z",
        },
      }),
    );
    assert.equal(result.imported, 0);
    assert.equal(result.skipped, 1);
  });
});
test("a failed solve write preserves the previously saved board", () => {
  return withStorage(async (storage) => {
    saveProgress("2026-09-15", "easy", [null], 12345);
    storage.setItem = () => {
      throw new Error("quota");
    };
    assert.equal((await recordSolve("2026-09-15", "easy", 15000)).status, "failed");
    assert.equal(getProgress("2026-09-15", "easy")?.elapsed, 12345);
  });
});

test("restored progress must fit the actual puzzle, including its domino count", () => {
  const puzzle = parsePuzzle({
    dominoes: [[1, 2]],
    regions: [
      {
        indices: [
          [0, 0],
          [0, 1],
        ],
        type: "empty",
      },
    ],
  });
  return withStorage(async () => {
    saveProgress(
      "2026-09-15",
      "easy",
      [
        {
          cells: [
            [9, 9],
            [9, 10],
          ],
        },
      ],
      1000,
    );
    assert.equal(getProgress("2026-09-15", "easy", puzzle), null);
    saveProgress("2026-09-15", "easy", [null, null], 1000);
    assert.equal(getProgress("2026-09-15", "easy", puzzle), null);
    saveProgress("2026-09-15", "easy", [null], 12345);
    assert.equal(getProgress("2026-09-15", "easy", puzzle)?.elapsed, 12345);
  });
});

test("first completion is immutable across faster, slower and duplicate callbacks", async () => {
  await withStorage(async (s) => {
    const first = await recordSolve("2026-09-19", "easy", 120000);
    assert.equal(first.status, "created");
    const original = s.getItem("pips-archive:v1:result:2026-09-19:easy");
    for (const ms of [60000, 180000, 120000]) {
      assert.equal((await recordSolve("2026-09-19", "easy", ms)).status, "existing");
      assert.equal(s.getItem("pips-archive:v1:result:2026-09-19:easy"), original);
    }
  });
});
test("legacy first and all metadata survive earlier faster conflicting backups", async () => {
  await withStorage(async (s) => {
    const k = "pips-archive:v1:result:2026-09-19:easy";
    s.setItem(k, JSON.stringify({ ...validResult, first: 120000, best: 60000 }));
    const original = s.getItem(k);
    assert.equal(
      (await importAll(backup({ [k]: { ...validResult, solvedAt: "2025-01-01T00:00:00Z" } })))
        .unchanged,
      1,
    );
    await recordSolve("2026-09-19", "easy", 0);
    assert.equal(s.getItem(k), original);
  });
});
test("corrupt and unreadable entries are never treated as missing", async () => {
  await withStorage(async (s) => {
    const k = "pips-archive:v1:result:2026-09-19:easy";
    for (const corrupt of ["", "null", "{", '{"first":0}']) {
      s.setItem(k, corrupt);
      assert.equal((await recordSolve("2026-09-19", "easy", 100)).status, "failed");
      assert.equal((await importAll(backup({ [k]: validResult }))).failed, 1);
      assert.equal(s.getItem(k), corrupt);
    }
    s.getItem = () => {
      throw new Error("denied");
    };
    assert.equal((await recordSolve("2026-09-19", "hard", 100)).status, "failed");
  });
});
test("invalid dates and durations cannot produce results; zero is valid", async () => {
  await withStorage(async () => {
    for (const ms of [-1, NaN, Infinity])
      assert.equal((await recordSolve("2026-09-19", "easy", ms)).status, "failed");
    for (const date of ["2026-02-30", "2026-9-19", "bad"])
      assert.equal((await recordSolve(date, "easy", 0)).status, "failed");
    assert.equal((await recordSolve("2026-09-19", "easy", 0)).status, "created");
  });
});
test("locking unavailable or rejected never falls back to unlocked writes", async () => {
  await withStorage(async () => {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
    assert.equal((await recordSolve("2026-09-19", "easy", 1)).reason, "locking");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { locks: { request: () => Promise.reject(new Error("denied")) } },
    });
    assert.equal((await recordSolve("2026-09-19", "easy", 1)).reason, "locking");
    assert.deepEqual(allResults(), []);
  });
});
test("concurrent writes return only one newly completed day in all six orders", async () => {
  for (const order of [
    ["easy", "medium", "hard"],
    ["easy", "hard", "medium"],
    ["medium", "easy", "hard"],
    ["medium", "hard", "easy"],
    ["hard", "easy", "medium"],
    ["hard", "medium", "easy"],
  ] as const) {
    await withStorage(async () => {
      const writes = await Promise.all(
        [...order, order[2]].map((l) => recordSolve("2026-09-19", l, 0)),
      );
      assert.deepEqual(
        writes.map((w) => w.completedDay),
        [false, false, true, false],
      );
      assert.equal(allResults().length, 3);
    });
  }
});

test("imports, erase and solves notify only after successful mutations", async () => {
  const { subscribeResults, eraseAll } = await import("./store");
  await withStorage(async (s) => {
    let notifications = 0;
    const unsubscribe = subscribeResults(() => notifications++);
    await recordSolve("2026-09-19", "easy", 1);
    await recordSolve("2026-09-19", "easy", 2);
    assert.equal(notifications, 1);
    await importAll(
      backup({
        "pips-archive:v1:result:2026-09-19:easy": validResult,
        "pips-archive:v1:result:2026-09-18:hard": validResult,
      }),
    );
    assert.equal(notifications, 2);
    assert.deepEqual(await eraseAll(), { erased: 2, failed: 0 });
    assert.equal(notifications, 3);
    unsubscribe();
    s.setItem = () => {
      throw new Error("quota");
    };
    await recordSolve("2026-09-19", "easy", 1);
    assert.equal(notifications, 3);
  });
});
test("different puzzle dates cannot combine into a third-completion transition", async () => {
  await withStorage(async () => {
    await recordSolve("2026-09-18", "easy", 1);
    await recordSolve("2026-09-19", "medium", 2);
    assert.equal((await recordSolve("2026-09-19", "hard", 3)).completedDay, false);
  });
});
