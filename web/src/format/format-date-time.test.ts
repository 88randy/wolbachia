import { describe, expect, test } from "vitest";
import { formatDateTime } from "./format-date-time";

const MOMENT = "2026-11-04T03:30:00Z";

describe("formatDateTime", () => {
  test("shows the moment in the organization's time zone, not in UTC", () => {
    // 03:30 UTC is the evening of the 3rd in Mexico City (UTC-6 in November).
    const text = formatDateTime(MOMENT, "es-MX", "America/Mexico_City");

    expect(text).toContain("3 nov 2026");
    expect(text).toContain("9:30");
  });

  test("the same moment is another day in another zone", () => {
    expect(formatDateTime(MOMENT, "es-MX", "Asia/Tokyo")).toContain("12:30");
  });

  test("follows the interface language", () => {
    expect(formatDateTime(MOMENT, "en", "UTC")).toMatch(/Nov 4, 2026/);
    expect(formatDateTime(MOMENT, "es-MX", "UTC")).toMatch(/4 nov 2026/);
  });

  test("returns a value that is not a date as it came", () => {
    expect(formatDateTime("not a date", "en", "UTC")).toBe("not a date");
  });
});
