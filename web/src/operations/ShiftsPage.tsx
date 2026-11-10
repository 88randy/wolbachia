import { useCan } from "../session/use-can";
import { NoPermissionState } from "../states/NoPermissionState";
import { ShiftList } from "./ShiftList";
export function ShiftsPage() {
  const can = useCan();
  return can("shift.read") ? <ShiftList /> : <NoPermissionState areaId="operations" />;
}
