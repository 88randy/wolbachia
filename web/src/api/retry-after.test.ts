import { describe, expect, test } from "vitest";
import { retryAfterMinutes } from "./retry-after";

const NOW = new Date("2026-11-04T12:00:00Z");

describe("retryAfterMinutes", () => {
  test.each([
    ["900", 15],
    ["60", 1],
    ["61", 2],
    ["1", 1],
    ["0", 1],
    [" 120 ", 2],
  ])("%j seconds -> %i min (rounded up, at least 1)", (header, minutes) => {
    expect(retryAfterMinutes(header, NOW)).toBe(minutes);
  });

  test("reads an HTTP date", () => {
    expect(retryAfterMinutes("Wed, 04 Nov 2026 12:10:00 GMT", NOW)).toBe(10);
  });

  test("a date in the past still asks for at least a minute", () => {
    expect(retryAfterMinutes("Wed, 04 Nov 2026 11:00:00 GMT", NOW)).toBe(1);
  });

  test.each([null, "", "soon", "-5", "1.5", "99999999"])("%j is unknown", (header) => {
    expect(retryAfterMinutes(header, NOW)).toBeUndefined();
  });
});
