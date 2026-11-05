import { describe, expect, test } from "vitest";
import { relativeTimeValue } from "./relative-time";

const NOW = Date.parse("2026-11-05T18:00:00Z");
describe("relativeTimeValue", () => {
  test.each([
    ["2026-11-05T17:59:30Z", -30, "second"],
    ["2026-11-05T17:57:00Z", -3, "minute"],
    ["2026-11-05T16:00:00Z", -2, "hour"],
    ["2026-11-03T18:00:00Z", -2, "day"],
    ["2026-10-22T18:00:00Z", -2, "week"],
    ["2026-08-05T18:00:00Z", -3, "month"],
    ["2025-11-05T18:00:00Z", -1, "year"],
    ["2026-11-05T18:03:00Z", 3, "minute"],
  ])("selects a meaningful unit for %s", (dateTime, value, unit) => {
    expect(relativeTimeValue(dateTime, NOW)).toEqual({ value, unit });
  });
  test("leaves invalid timestamps visible instead of inventing a relative date", () => {
    expect(relativeTimeValue("unknown", NOW)).toBeNull();
  });
});
