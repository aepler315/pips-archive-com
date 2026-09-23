import { HINT_MARKER, isAssistedSnapshot, scoredFirstMs } from "./hints";
import { LEVELS } from "./engine";
import { formatResultDate, formatResultDuration, type DayResults } from "./daily-results";
export function buildDailyShareText(summary: DayResults): string {
  if (!summary.complete || LEVELS.some((l) => !summary.records[l]))
    throw new Error("Complete all three puzzles before sharing");
  return [
    `Pips ${formatResultDate(summary.date)}`,
    ...LEVELS.map((l) => {
      const record = summary.records[l]!;
      const marker = isAssistedSnapshot(record.assistance) ? ` ${HINT_MARKER}` : "";
      return `${l[0].toUpperCase() + l.slice(1)}: ${formatResultDuration(scoredFirstMs(record))}${marker}`;
    }),
    "pipsarchive.com",
  ].join("\n");
}
export function copyDailyResults(
  text: string,
  clipboard: Pick<Clipboard, "writeText">,
): Promise<void> {
  return clipboard.writeText(text);
}
