import { describe, expect, test } from "vitest";
import { exportPollInterval, validateExportDates } from "./annotation-export-domain";

describe("annotation dataset export rules", () => {
  test.each([
    ["", "2026-11-25", "required"],
    ["2026-11-25", "", "required"],
    ["2026-02-30", "2026-03-01", "invalid"],
    ["9999-12-31", "9999-12-31", "invalid"],
    ["0000-01-01", "0000-01-01", "invalid"],
    ["2026-11-25", "2026-11-24", "range"],
    ["2024-01-01", "2024-12-31", null],
    ["2024-01-01", "2025-01-01", "tooLong"],
    ["2026-11-25", "2026-11-25", null],
  ])("validates inclusive dates %s through %s", (from, to, expected) => {
    expect(validateExportDates(from, to)).toBe(expected);
  });

  test("polls only when a visible export is queued or running", () => {
    expect(exportPollInterval(undefined)).toBe(false);
    expect(exportPollInterval([])).toBe(false);
    expect(
      exportPollInterval([{ status: "ready" }, { status: "failed" }, { status: "expired" }]),
    ).toBe(false);
    expect(exportPollInterval([{ status: "queued" }, { status: "ready" }])).toBe(3000);
    expect(exportPollInterval([{ status: "running" }])).toBe(3000);
  });
});
