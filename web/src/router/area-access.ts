import type { Me } from "../session/me";
import { can } from "../session/can";
import { AREAS, PENDING } from "./areas";
import type { Area } from "./areas";
/** `"pending"` stays allowed so a new area can start without codes. */
interface AreaPermissions {
  requiredPermissions: Area["requiredPermissions"] | typeof PENDING;
}
/** Navigation checks action codes; resource-specific dimensions belong to their own guards. */
export function canOpenArea(me: Pick<Me, "permissions">, area: AreaPermissions): boolean {
  const { requiredPermissions } = area;
  if (requiredPermissions === PENDING) return true;
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.some((permission) => can(me, permission));
}
export function pendingAreaIds(): readonly Area["id"][] {
  return AREAS.filter((area) => (area.requiredPermissions as unknown) === PENDING).map((area) => area.id);
}
