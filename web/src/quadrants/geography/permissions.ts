import type { Me } from "../../session/me";
export const QUADRANT_READ = "quadrant.read";
export const QUADRANT_PUBLISH = "quadrant.publish";
export const POINT_CREATE = "sampling_point.create";
function hasDimension(dimension: Me["scope"]["centers"]): boolean {
  return dimension.mode === "all" || (dimension.mode === "selected" && dimension.ids.length > 0);
}
export function hasGeographyAccess(me: Me): boolean {
  return (
    me.permissions.includes(QUADRANT_READ) &&
    hasDimension(me.scope.centers) &&
    hasDimension(me.scope.quadrants)
  );
}
export function coversRecord(me: Me, record: { id: string; center: string }): boolean {
  return (
    hasGeographyAccess(me) &&
    (me.scope.centers.mode === "all" || me.scope.centers.ids.includes(record.center)) &&
    (me.scope.quadrants.mode === "all" || me.scope.quadrants.ids.includes(record.id))
  );
}
/** Access context is part of both query keys and content remount keys, without writing session state. */
export function geographyContext(me: Me): string {
  return JSON.stringify([
    me.user.id,
    me.organization?.slug,
    me.scope.centers.mode,
    [...me.scope.centers.ids].sort(),
    me.scope.quadrants.mode,
    [...me.scope.quadrants.ids].sort(),
    [...me.permissions].sort(),
  ]);
}
