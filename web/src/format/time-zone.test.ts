import { describe, expect, it } from "vitest";
import { filterValueOfDate } from "../data-table/filter-dates";
import { isToday } from "../lab/count-side-query";
import { formatDateTime } from "./format-date-time";
import { calendarDayOf, todayIn, zonedDayStart, zonedLocalToIso } from "./time-zone";

const MERIDA = "America/Merida";
// 20:30 on 10 Nov in Mérida (UTC-6): the UTC date is already 11 Nov.
const EVENING = "2026-11-11T02:30:00Z";

describe("organization time zone at the Mérida evening boundary", () => {
  it("formats an instant in the organization's zone, not UTC", () => {
    const text = formatDateTime(EVENING, "en", MERIDA);
    expect(text).toContain("Nov 10, 2026");
    expect(text).toContain("8:30");
  });

  it("takes today and the day of an instant from the organization's calendar", () => {
    expect(todayIn(MERIDA, new Date(EVENING))).toBe("2026-11-10");
    expect(calendarDayOf(EVENING, MERIDA)).toBe("2026-11-10");
    expect(isToday("2026-11-10T13:00:00Z", MERIDA, new Date(EVENING))).toBe(true);
    expect(isToday(EVENING, "UTC", new Date("2026-11-10T13:00:00Z"))).toBe(false);
  });

  it("sends filter days as the organization's local midnight", () => {
    expect(zonedDayStart("2026-11-10", MERIDA)).toBe("2026-11-10T00:00:00-06:00");
    const filter = { key: "created_before", dateFormat: "datetime" } as Parameters<
      typeof filterValueOfDate
    >[1];
    expect(filterValueOfDate(new Date(2026, 10, 10), filter, "end", MERIDA)).toBe(
      "2026-11-11T00:00:00-06:00",
    );
  });

  it("reads a typed wall clock in the organization's zone", () => {
    expect(zonedLocalToIso("2026-11-10T20:30", MERIDA)).toBe("2026-11-11T02:30:00.000Z");
  });
});
