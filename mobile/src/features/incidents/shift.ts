import type { ShiftOpenService } from "../shift-open/service.ts";
import { captureShiftId } from "../ovitrap-check/shift-authorization.ts";
import type { IncidentShift } from "./service.ts";

/** No operational shift is wire null; the legacy departure helper represents it as empty text. */
export async function readIncidentShift(
  service: Pick<ShiftOpenService, "readWithGuard">,
): Promise<IncidentShift> {
  const { snapshot, guard } = await service.readWithGuard();
  return { id: captureShiftId(snapshot) || null, guard };
}
