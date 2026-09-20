import { profilePuzzle } from "../src/lib/pips/puzzle-complexity.ts";
import { validAnalysis } from "../src/lib/pips/puzzle-analysis.ts";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { countWinningArrangements, hashPuzzle } from "../src/lib/pips/solution-count.ts";
import {
  constraintInformationBits,
  countUnconstrainedArrangements,
} from "../src/lib/pips/solution-space.ts";

const SCHEMA_VERSION = 1;
const COUNTING_VERSION = "winning-arrangements-v1";
const EQUIVALENCE_VERSION = "fixed-board-unlabeled-dominoes-v1";
const levels = ["easy", "medium", "hard"];

function argumentMap(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`unknown argument ${key}`);
    if (key === "--retry-bounded") args.set(key, true);
    else args.set(key, argv[++index]);
  }
  return args;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new Error(`${name} must be a nonnegative safe integer`);
  return parsed;
}

function optionsFrom(argv) {
  const args = argumentMap(argv);
  const root = args.get("--root") ?? process.cwd();
  const from = args.get("--from");
  const to = args.get("--to") ?? from;
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
    throw new Error("--from and --to must use YYYY-MM-DD");
  }
  if (from && to < from) throw new Error("--to must not be earlier than --from");
  const budget = {
    nodeBudget: args.has("--node-budget")
      ? positiveInteger(args.get("--node-budget"), "--node-budget")
      : 50_000,
    memoEntryBudget: args.has("--memo-entry-budget")
      ? positiveInteger(args.get("--memo-entry-budget"), "--memo-entry-budget")
      : 25_000,
    deadlineMs: args.has("--deadline-ms")
      ? positiveInteger(args.get("--deadline-ms"), "--deadline-ms")
      : 3_000,
  };
  return {
    root,
    from,
    to,
    maxDates: args.has("--max-dates")
      ? positiveInteger(args.get("--max-dates"), "--max-dates")
      : Infinity,
    retryBounded: args.get("--retry-bounded") === true,
    budget,
    budgetPolicy: `nodes=${budget.nodeBudget};memo=${budget.memoEntryBudget};deadline-ms=${budget.deadlineMs}`,
  };
}

function analysisPaths(root) {
  const data = join(root, "data");
  return {
    puzzles: join(data, "puzzles"),
    analysis: join(data, "analysis"),
    index: join(data, "analysis", "index.json"),
  };
}

function datesInRange(puzzles, from, to) {
  const dates = readdirSync(puzzles)
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .map((file) => file.slice(0, 10))
    .filter((date) => (!from || date >= from) && (!to || date <= to))
    .sort();
  return dates.reverse();
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeChanged(path, value) {
  const text = `${JSON.stringify(value)}\n`;
  if (existsSync(path) && readFileSync(path, "utf8") === text) return false;
  mkdirSync(join(path, ".."), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, text);
  renameSync(temporary, path);
  return true;
}

function currentEnough(existing, hashes, budgetPolicy, retryBounded) {
  if (
    !existing ||
    existing.schemaVersion !== SCHEMA_VERSION ||
    existing.countingVersion !== COUNTING_VERSION
  )
    return false;
  for (const level of levels) {
    const prior = existing.analyses?.[level];
    if (
      !validAnalysis(prior, existing.date, level, hashes[level]) ||
      !prior.structural ||
      prior.structural.solverVersion !== "first-solution-v1"
    )
      return false;
    if (
      prior.winning?.status === "exact" &&
      prior.unconstrained?.status === "exact" &&
      prior.structural?.status === "complete"
    )
      continue;
    if (!retryBounded && existing.budgetPolicy === budgetPolicy) continue;
    return false;
  }
  return true;
}

async function analyzeDay(date, raw, hashes, budget) {
  const analyses = {};
  for (const level of levels) {
    const puzzle = raw[level];
    const puzzleHash = hashes[level];
    const winning = countWinningArrangements(puzzle, budget);
    const unconstrained = countUnconstrainedArrangements(puzzle, budget);
    if (winning.status === "exact" && winning.count === "0")
      throw new Error(`Quarantined ${date}/${level}: exact zero for archive puzzle`);
    analyses[level] = {
      schemaVersion: SCHEMA_VERSION,
      puzzleHash,
      countingVersion: COUNTING_VERSION,
      equivalenceVersion: EQUIVALENCE_VERSION,
      date,
      level,
      winning,
      unconstrained,
      constraintInformationBits: constraintInformationBits(winning, unconstrained),
      structural: await profilePuzzle(puzzle, budget),
    };
  }
  return analyses;
}

function compactIndex(analysisDir) {
  const dates = existsSync(analysisDir)
    ? readdirSync(analysisDir)
        .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
        .map((file) => file.slice(0, 10))
        .sort()
    : [];
  return {
    schemaVersion: SCHEMA_VERSION,
    countingVersion: COUNTING_VERSION,
    dates,
    puzzles: Object.fromEntries(
      dates.flatMap((date) => {
        const day = readJson(join(analysisDir, `${date}.json`));
        return levels.flatMap((level) => {
          const a = day?.analyses?.[level];
          return a
            ? [
                [
                  `${date}:${level}`,
                  {
                    puzzleHash: a.puzzleHash,
                    solverVersion: a.structural?.solverVersion,
                    medianFirstSolutionNodes: a.structural?.medianFirstSolutionNodes,
                    rootForcedFraction: a.structural?.rootForcedFraction,
                  },
                ],
              ]
            : [];
        });
      }),
    ),
  };
}

export async function runAnalysis(argv = process.argv.slice(2)) {
  const options = optionsFrom(argv);
  const paths = analysisPaths(options.root);
  if (!existsSync(paths.puzzles)) throw new Error(`puzzle directory not found: ${paths.puzzles}`);
  mkdirSync(paths.analysis, { recursive: true });
  const changed = [];
  let skipped = 0;
  let attempted = 0;
  for (const date of datesInRange(paths.puzzles, options.from, options.to, options.maxDates)) {
    const raw = readJson(join(paths.puzzles, `${date}.json`));
    if (!raw) throw new Error(`invalid puzzle payload for ${date}`);
    const path = join(paths.analysis, `${date}.json`);
    const existing = readJson(path);
    const hashes = Object.fromEntries(
      await Promise.all(levels.map(async (level) => [level, await hashPuzzle(raw[level])])),
    );
    if (currentEnough(existing, hashes, options.budgetPolicy, options.retryBounded)) {
      skipped++;
      continue;
    }
    if (attempted >= options.maxDates) break;
    attempted++;
    const analyses = await analyzeDay(date, raw, hashes, options.budget);
    for (const level of levels) {
      const prior = existing?.analyses?.[level];
      if (!validAnalysis(prior, date, level, hashes[level])) continue;
      for (const field of ["winning", "unconstrained"]) {
        const old = prior[field],
          next = analyses[level][field];
        if (
          old.status === "exact" ||
          (old.status === "bounded" &&
            next.status === "bounded" &&
            BigInt(old.lowerBound) > BigInt(next.lowerBound))
        )
          analyses[level][field] = old;
      }
      if (prior.structural?.status === "complete") analyses[level].structural = prior.structural;
      analyses[level].constraintInformationBits = constraintInformationBits(
        analyses[level].winning,
        analyses[level].unconstrained,
      );
    }
    const reference = readJson(join(paths.analysis, "reference-v1.json"));
    if (
      reference?.rankable &&
      reference.solverVersion === "first-solution-v1" &&
      reference.coverage?.complete === 90 &&
      reference.sortedLogWork?.length === 90 &&
      reference.sortedLogWork.every(Number.isFinite)
    ) {
      for (const level of levels) {
        const s = analyses[level].structural;
        if (s?.status !== "complete") continue;
        const work = Math.log1p(s.medianFirstSolutionNodes);
        const less = reference.sortedLogWork.filter((n) => n < work).length;
        const equal = reference.sortedLogWork.filter((n) => n === work).length;
        s.percentile = (100 * (less + equal / 2)) / 90;
        s.referenceVersion = reference.version;
        s.referenceCoverage = reference.coverage;
      }
    }
    const sidecar = {
      schemaVersion: SCHEMA_VERSION,
      date,
      countingVersion: COUNTING_VERSION,
      equivalenceVersion: EQUIVALENCE_VERSION,
      budgetPolicy: options.budgetPolicy,
      analyses,
    };
    if (writeChanged(path, sidecar)) changed.push(date);
  }
  if (writeChanged(paths.index, compactIndex(paths.analysis))) changed.push("index");
  return { changed, skipped };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  runAnalysis()
    .then(({ changed, skipped }) =>
      console.log(`analysis: ${changed.length} updated, ${skipped} unchanged`),
    )
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
