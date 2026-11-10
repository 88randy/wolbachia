import type { Me } from "../../session/me";
import { can } from "../../session/can";

/** `GET/POST /permit-types/` and `/permits/` need `permit.manage`; suspending needs `permit.suspend`. */
export const PERMIT_MANAGE = "permit.manage";
export const PERMIT_SUSPEND = "permit.suspend";

/** A permit type is organization-wide: the backend only accepts it from a whole-scope grant. */
export function canCreatePermitType(me: Me): boolean {
  return (
    can(me, PERMIT_MANAGE) && me.scope.centers.mode === "all" && me.scope.quadrants.mode === "all"
  );
}

/** A permit lives in one quadrant: at least one quadrant must be inside the user's scope. */
export function canCreatePermit(me: Me): boolean {
  const { centers, quadrants } = me.scope;
  const hasAny = (dimension: Me["scope"]["centers"]) =>
    dimension.mode === "all" || (dimension.mode === "selected" && dimension.ids.length > 0);
  return can(me, PERMIT_MANAGE) && hasAny(centers) && hasAny(quadrants);
}
