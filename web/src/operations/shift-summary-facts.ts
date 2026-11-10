import type { Locale } from "@wolbachia/i18n";
import type { ShiftDetail } from "./shift-validation";

/** Format only the shift facts exposed by the current API, retaining unavailable values. */
export function buildShiftSummaryFacts(
  shift: ShiftDetail,
  language: Locale,
  unavailable: string,
  courierName: string,
) {
  return [
    ["shift.field.courier", courierName],
    ["shift.field.motorcycle", shift.motorcycle_code],
    ["shift.field.odometerOpen", shift.odometer_open_km.toLocaleString(language)],
    ["shift.field.odometerClose", shift.odometer_close_km?.toLocaleString(language) ?? unavailable],
  ] as const;
}
