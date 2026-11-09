import type { ShiftSnapshot } from "../shift-open/service.ts";
import type { ShiftOpenService } from "../shift-open/service.ts";
import type { SqlStatement } from "../../db/sql.ts";
export interface CaptureShiftAuthorization {
  readonly id: string;
  readonly guard: SqlStatement;
}
/** Validate exactly the snapshot whose original durable facts guard publication. */
export async function readCaptureShift(
  source: Pick<ShiftOpenService, "readWithGuard">,
): Promise<CaptureShiftAuthorization> {
  const { snapshot, guard } = await source.readWithGuard();
  const id = captureShiftId(snapshot);
  if (!id) throw new ShiftBlockedError();
  return { id, guard };
}
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
