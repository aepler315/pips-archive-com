import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDay } from "./days.ts";

const validDay = {
  printDate: "2026-09-12",
  easy: {},
  medium: {},
  hard: {},
};

test("loadDay distinguishes an absent archive entry from a failed request", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  Object.assign(globalThis, { window: {} });
  globalThis.fetch = async () => new Response(null, { status: 404 });
  try {
    assert.deepEqual(await loadDay("1999-01-01"), { kind: "missing" });
  } finally {
    Object.assign(globalThis, { window: originalWindow, fetch: originalFetch });
  }
});

test("loadDay reports a retryable request failure", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  Object.assign(globalThis, { window: {} });
  globalThis.fetch = async () => new Response(null, { status: 503 });
  try {
    assert.deepEqual(await loadDay("1999-01-02"), { kind: "error" });
  } finally {
    Object.assign(globalThis, { window: originalWindow, fetch: originalFetch });
  }
});

test("loadDay returns a parsed archived puzzle", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  Object.assign(globalThis, { window: {} });
  globalThis.fetch = async () => Response.json(validDay);
  try {
    assert.deepEqual(await loadDay("1999-01-03"), { kind: "ok", day: validDay });
  } finally {
    Object.assign(globalThis, { window: originalWindow, fetch: originalFetch });
  }
});
