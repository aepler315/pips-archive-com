import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function expandCronField(field, min, max) {
  const values = new Set();
  for (const item of field.split(",")) {
    const [range, stepText] = item.split("/");
    const step = stepText ? Number(stepText) : 1;
    let start;
    let end;
    if (range === "*") {
      start = min;
      end = max;
    } else if (range.includes("-")) {
      [start, end] = range.split("-").map(Number);
    } else {
      start = Number(range);
      end = stepText ? max : start;
    }
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return [...values];
}

function scheduledLocalMinutes(workflow, timezone) {
  const schedules = [
    ...workflow.matchAll(
      /- cron:\s*["']([^"']+)["']\s*\n\s*timezone:\s*["']?([^"'\s]+)["']?/g,
    ),
  ].map((match) => ({ cron: match[1], timezone: match[2] }));

  assert.ok(schedules.length > 0, "daily workflow must declare scheduled retries");
  assert.ok(
    schedules.every((schedule) => schedule.timezone === timezone),
    `every puzzle retry must use ${timezone}`,
  );

  const minutes = new Set();
  for (const { cron } of schedules) {
    const [minuteField, hourField] = cron.split(/\s+/);
    for (const hour of expandCronField(hourField, 0, 23)) {
      for (const minute of expandCronField(minuteField, 0, 59)) {
        minutes.add(hour * 60 + minute);
      }
    }
  }
  return [...minutes].sort((a, b) => a - b);
}

test("daily workflow retries at least every ten minutes for two hours after New York midnight", () => {
  const workflow = readFileSync(".github/workflows/daily.yml", "utf8");
  const attempts = scheduledLocalMinutes(workflow, "America/New_York").filter(
    (minute) => minute < 120,
  );

  assert.ok(attempts[0] <= 5, `first retry is ${attempts[0]} minutes after midnight`);
  const gaps = [
    attempts[0],
    ...attempts.slice(1).map((minute, index) => minute - attempts[index]),
    120 - attempts.at(-1),
  ];
  assert.ok(
    Math.max(...gaps) <= 10,
    `retry gap is ${Math.max(...gaps)} minutes: ${attempts.join(", ")}`,
  );
});
