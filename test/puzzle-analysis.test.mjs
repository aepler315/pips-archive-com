import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const script = join(root, "scripts", "analyze-puzzles.mjs");
const date = "2026-09-19";
const day = {
  printDate: date,
  easy: {
    dominoes: [[1, 2]],
    regions: [
      {
        type: "empty",
        indices: [
          [0, 0],
          [0, 1],
        ],
      },
    ],
  },
  medium: {
    dominoes: [[2, 2]],
    regions: [
      {
        type: "empty",
        indices: [
          [0, 0],
          [0, 1],
        ],
      },
    ],
  },
  hard: {
    dominoes: [[0, 0]],
    regions: [
      {
        type: "empty",
        indices: [
          [0, 0],
          [0, 1],
        ],
      },
    ],
  },
};

function tempArchive() {
  const archive = mkdtempSync(join(tmpdir(), "pips-analysis-"));
  mkdirSync(join(archive, "data", "puzzles"), { recursive: true });
  writeFileSync(join(archive, "data", "puzzles", `${date}.json`), JSON.stringify(day));
  return archive;
}

function analyze(archive, ...args) {
  return execFileSync(
    process.execPath,
    ["--import", "tsx", script, "--root", archive, "--from", date, "--to", date, ...args],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
}

test("analysis CLI creates deterministic derived sidecars and a compact index", () => {
  const archive = tempArchive();
  try {
    analyze(archive);
    const sidecarPath = join(archive, "data", "analysis", `${date}.json`);
    const first = readFileSync(sidecarPath, "utf8");
    const sidecar = JSON.parse(first);
    assert.equal(sidecar.schemaVersion, 1);
    assert.equal(sidecar.analyses.easy.winning.count, "2");
    assert.equal(sidecar.analyses.medium.winning.count, "1");
    assert.equal(sidecar.analyses.hard.winning.count, "1");
    assert.equal(Object.hasOwn(sidecar.analyses.easy, "solution"), false);
    const index = JSON.parse(readFileSync(join(archive, "data", "analysis", "index.json"), "utf8"));
    assert.deepEqual(index.dates, [date]);
    analyze(archive);
    assert.equal(readFileSync(sidecarPath, "utf8"), first);
  } finally {
    rmSync(archive, { recursive: true, force: true });
  }
});

test("analysis CLI repairs missing, corrupt, and unsupported sidecars", () => {
  const archive = tempArchive();
  const sidecarPath = join(archive, "data", "analysis", `${date}.json`);
  try {
    analyze(archive);
    writeFileSync(sidecarPath, "not json");
    analyze(archive);
    assert.equal(JSON.parse(readFileSync(sidecarPath, "utf8")).schemaVersion, 1);
    writeFileSync(sidecarPath, JSON.stringify({ schemaVersion: 999 }));
    analyze(archive);
    assert.equal(JSON.parse(readFileSync(sidecarPath, "utf8")).schemaVersion, 1);
  } finally {
    rmSync(archive, { recursive: true, force: true });
  }
});

test("bounded retries never weaken an existing proven bound", () => {
  const archive = tempArchive();
  try {
    analyze(archive);
    const path = join(archive, "data", "analysis", `${date}.json`);
    const prior = JSON.parse(readFileSync(path, "utf8"));
    prior.analyses.easy.winning = { status: "bounded", lowerBound: "1", reason: "node-budget" };
    prior.analyses.easy.constraintInformationBits = null;
    writeFileSync(path, JSON.stringify(prior));
    analyze(archive, "--retry-bounded", "--node-budget", "0");
    assert.equal(JSON.parse(readFileSync(path, "utf8")).analyses.easy.winning.lowerBound, "1");
  } finally {
    rmSync(archive, { recursive: true, force: true });
  }
});
test("a known embedded valid finish cannot publish exact zero", () => {
  const archive = tempArchive();
  try {
    analyze(archive);
    const path = join(archive, "data", "analysis", `${date}.json`);
    const prior = JSON.parse(readFileSync(path, "utf8"));
    prior.analyses.easy.winning = { status: "exact", count: "0" };
    writeFileSync(path, JSON.stringify(prior));
    analyze(archive);
    assert.equal(JSON.parse(readFileSync(path, "utf8")).analyses.easy.winning.count, "2");
  } finally {
    rmSync(archive, { recursive: true, force: true });
  }
});

test("benchmarking reuses the frozen reference without rewriting it", () => {
  const archive = tempArchive();
  try {
    const before = readFileSync(join(root, "data", "analysis", "reference-v1.json"), "utf8");
    const reference = JSON.parse(before);
    mkdirSync(join(archive, "data", "analysis"), { recursive: true });
    const path = join(archive, "data", "analysis", "reference-v1.json");
    writeFileSync(path, before);
    for (const row of reference.corpus)
      writeFileSync(
        join(archive, "data", "puzzles", `${row.date}.json`),
        readFileSync(join(root, "data", "puzzles", `${row.date}.json`)),
      );
    // Tomorrow's extra puzzle must never enter the frozen benchmark cohort.
    writeFileSync(join(archive, "data", "puzzles", "2099-01-01.json"), JSON.stringify(day));
    execFileSync(
      process.execPath,
      [
        "--import",
        join(root, "node_modules/tsx/dist/loader.mjs"),
        join(root, "scripts", "benchmark-analysis.mjs"),
      ],
      { cwd: archive, stdio: "pipe" },
    );
    assert.equal(readFileSync(path, "utf8"), before);
    const report = JSON.parse(
      readFileSync(join(archive, "data", "analysis", "benchmark-v1.json"), "utf8"),
    );
    assert.deepEqual(
      report.rows.map((r) => r.puzzleHash),
      reference.corpus.map((r) => r.puzzleHash),
    );
  } finally {
    rmSync(archive, { recursive: true, force: true });
  }
});
