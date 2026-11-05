import { describe, expect, test } from "vitest";
import { formatCalendarDate, formatDate } from "./format-date";

describe("formatDate", () => {
  test("is the day in the organization's time zone, not in UTC", () => {
    // 03:30 UTC is still the evening of the 3rd in Mexico City.
    expect(formatDate("2026-11-04T03:30:00Z", "es-MX", "America/Mexico_City")).toBe("3 nov 2026");
    expect(formatDate("2026-11-04T03:30:00Z", "en", "UTC")).toBe("Nov 4, 2026");
  });

  test("returns a value that is not a date as it came", () => {
    expect(formatDate("not a date", "en", "UTC")).toBe("not a date");
  });
});

describe("formatCalendarDate", () => {
  test("writes the day as named, whatever the machine's time zone", () => {
    expect(formatCalendarDate("2026-11-10", "es-MX")).toBe("10 nov 2026");
    expect(formatCalendarDate("2026-01-01", "en")).toBe("Jan 1, 2026");
  });

  test("returns a value that is not a calendar date as it came", () => {
    expect(formatCalendarDate("2026-11-10T00:00:00Z", "en")).toBe("2026-11-10T00:00:00Z");
  });
});
