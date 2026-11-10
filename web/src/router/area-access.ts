import type { Me } from "../session/me";
import { can } from "../session/can";
import { AREAS, PENDING } from "./areas";
import type { Area } from "./areas";
interface AreaPermissions {
  requiredPermissions: Area["requiredPermissions"];
}
/** Navigation checks action codes; resource-specific dimensions belong to their own guards. */
export function canOpenArea(
  me: Pick<Me, "permissions"> & Partial<Pick<Me, "is_platform_admin" | "organization">>,
  area: AreaPermissions & { platformOnly?: boolean },
): boolean {
  if (area.platformOnly === true) return me.is_platform_admin === true;
  // A platform admin without an organization opens only the platform area.
  if (me.organization === null) return false;
  const { requiredPermissions } = area;
  if (requiredPermissions === PENDING) return true;
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.some((permission) => can(me, permission));
}
export function pendingAreaIds(): readonly Area["id"][] {
  return AREAS.filter((area) => area.requiredPermissions === PENDING).map((area) => area.id);
}
