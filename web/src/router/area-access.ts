import type { Me } from "../session/me";
import { can } from "../session/can";
import { hasCenterScope } from "../centers/center-selection";
import { ORGANIZATION_READ, ROLE_READ } from "../settings/organization/permissions";
import { AREAS, PENDING } from "./areas";
import type { Area } from "./areas";
interface AreaPermissions {
  requiredPermissions: Area["requiredPermissions"];
}
type Viewer = Pick<Me, "permissions"> & Partial<Pick<Me, "scope">>;
function hasAreaPermission(me: Viewer, permission: string): boolean {
  if (!can(me, permission)) return false;
  if (permission !== ORGANIZATION_READ && permission !== ROLE_READ) return true;
  return me.scope !== undefined && hasCenterScope(me.scope);
}
/** Action permission and applicable explicit scope determine whether the area is visible. */
export function canOpenArea(me: Viewer, area: AreaPermissions): boolean {
  const { requiredPermissions } = area;
  if (requiredPermissions === PENDING) return true;
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.some((permission) => hasAreaPermission(me, permission));
}
export function pendingAreaIds(): readonly Area["id"][] {
  return AREAS.filter((area) => area.requiredPermissions === PENDING).map((area) => area.id);
}
