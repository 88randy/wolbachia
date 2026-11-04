import type { Me } from "../session/me";
import { canAny } from "../session/can";
import { AREAS, PENDING } from "./areas";
import type { Area } from "./areas";

interface AreaPermissions {
  requiredPermissions: Area["requiredPermissions"];
}

/** Whether the user may open (and should see in the navigation) an area. */
export function canOpenArea(me: Pick<Me, "permissions">, area: AreaPermissions): boolean {
  const { requiredPermissions } = area;
  if (requiredPermissions === PENDING) return true;
  if (requiredPermissions.length === 0) return true;
  return canAny(me, requiredPermissions);
}

/** Areas whose permission code is not defined yet (visible to every member). */
export function pendingAreaIds(): readonly Area["id"][] {
  return AREAS.filter((area) => area.requiredPermissions === PENDING).map((area) => area.id);
}
