import type { ShiftSnapshot } from "../shift-open/service.ts";
/** Use the same operational permission as departure, including severe server review. */
export function captureShiftId(shift: ShiftSnapshot | null): string {
  return shift?.canDepart && shift.gate === null && shift.opening
    ? (shift.draft?.clientShiftId ?? "")
    : "";
}
export class ShiftBlockedError extends Error {
  constructor() {
    super("Shift does not authorize capture.");
    this.name = "ShiftBlockedError";
  }
}
