import { LEVELS, type Level } from "./engine";
import { eligible, orderedRecords } from "./performance";
import type { AnchorRecord } from "./performance-types";
export type CalibrationSample = AnchorRecord & {
  puzzleHash: string;
  analysisHash: string;
  dominoCount: number;
  firstSolutionNodes: number;
  rootForcedFraction: number;
};
export type ModelEpoch = {
  schemaVersion: 1;
  modelVersion: "structural-log-time-v1";
  trainingCutoff: string;
  referenceLogTime: number;
  coefficients: number[];
  means: number[];
  scales: number[];
  featureVersion: "level-size-work-forced-v1";
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const features = (s: CalibrationSample) => [
  Number(s.level === "medium"),
  Number(s.level === "hard"),
  Math.log(s.dominoCount),
  Math.log1p(s.firstSolutionNodes),
  s.rootForcedFraction,
];
/** Local experiment only: it never writes storage or changes the active scoring epoch. */
export function evaluateCalibration(input: CalibrationSample[]) {
  const good = input.filter(
    (s) =>
      eligible(s) &&
      /^[a-f0-9]{64}$/.test(s.puzzleHash) &&
      s.puzzleHash === s.analysisHash &&
      Number.isInteger(s.dominoCount) &&
      s.dominoCount > 0 &&
      Number.isFinite(s.firstSolutionNodes) &&
      s.firstSolutionNodes > 0 &&
      Number.isFinite(s.rootForcedFraction) &&
      s.rootForcedFraction >= 0 &&
      s.rootForcedFraction <= 1,
  );
  const data = orderedRecords(good);
  const insufficient = { status: "insufficient" as const, activeModel: "level-anchor-v1" as const };
  if (data.length < 120 || LEVELS.some((l) => data.filter((s) => s.level === l).length < 30))
    return insufficient;
  let split = data.length - Math.max(30, Math.ceil(data.length * 0.2));
  // A shared timestamp never straddles training and holdout.
  while (split > 0 && data[split - 1].solvedAt === data[split].solvedAt) split--;
  const training = data.slice(0, split),
    holdout = data.slice(split);
  if (
    training.length < 60 ||
    LEVELS.some(
      (l) =>
        training.filter((s) => s.level === l).length < 10 ||
        holdout.filter((s) => s.level === l).length < 8,
    )
  )
    return insufficient;
  const raw = training.map(features);
  const means = raw[0].map((_, j) => mean(raw.map((x) => x[j])));
  const scales = means.map((m, j) => Math.sqrt(mean(raw.map((x) => (x[j] - m) ** 2))) || 1);
  const vector = (s: CalibrationSample) => [
    1,
    ...features(s).map((x, j) => (x - means[j]) / scales[j]),
  ];
  const xs = training.map(vector),
    ys = training.map((s) => Math.log(s.first));
  const coefficients = [mean(ys), 0, 0, 0, 0, 0];
  // Ridge regression via fixed deterministic gradient steps on training data only.
  for (let iteration = 0; iteration < 1500; iteration++) {
    const gradient = coefficients.map(() => 0);
    xs.forEach((x, i) => {
      const error = x.reduce((n, v, j) => n + v * coefficients[j], 0) - ys[i];
      x.forEach((v, j) => {
        gradient[j] += (error * v) / xs.length;
      });
    });
    coefficients.forEach((c, j) => {
      coefficients[j] -= 0.03 * (gradient[j] + (j === 0 ? 0 : 0.1 * c));
    });
  }
  const band = Object.fromEntries(
    LEVELS.map((l) => [
      l,
      mean(training.filter((s) => s.level === l).map((s) => Math.log(s.first))),
    ]),
  ) as Record<Level, number>;
  const errors = holdout.map((s) => ({
    level: s.level,
    candidate: Math.abs(
      vector(s).reduce((n, v, j) => n + v * coefficients[j], 0) - Math.log(s.first),
    ),
    band: Math.abs(band[s.level] - Math.log(s.first)),
  }));
  const perLevel = Object.fromEntries(
    LEVELS.map((l) => {
      const es = errors.filter((e) => e.level === l);
      return [
        l,
        {
          count: es.length,
          candidate: mean(es.map((e) => e.candidate)),
          band: mean(es.map((e) => e.band)),
        },
      ];
    }),
  ) as Record<Level, { count: number; candidate: number; band: number }>;
  const candidateError = mean(errors.map((e) => e.candidate)),
    bandError = mean(errors.map((e) => e.band));
  const eligibleForReview =
    bandError > 0 &&
    candidateError <= 0.9 * bandError &&
    LEVELS.every((l) => perLevel[l].candidate <= 1.1 * perLevel[l].band);
  const epoch: ModelEpoch = {
    schemaVersion: 1,
    modelVersion: "structural-log-time-v1",
    trainingCutoff: training.at(-1)!.solvedAt,
    referenceLogTime: mean(ys),
    coefficients,
    means,
    scales,
    featureVersion: "level-size-work-forced-v1",
  };
  return {
    status: eligibleForReview ? ("eligible-for-review" as const) : ("not-promoted" as const),
    activeModel: "level-anchor-v1" as const,
    trainingCount: training.length,
    holdoutCount: holdout.length,
    candidateError,
    bandError,
    perLevel,
    epoch,
    requiresConfoundingReview: true as const,
  };
}
