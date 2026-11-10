import type { Me } from "../../session/me";
import { isDimensionAllowed, isUuid } from "./evaluation-domain";
import { hasCenterScope } from "../../centers/center-selection";
function isOptionalScopeAllowed(dimension: Me["scope"]["centers"], value?: string) {
  return value === undefined || (isUuid(value) && isDimensionAllowed(dimension, value));
}
/** Validate every supplied context dimension independently, before any private resource query. */
export function canOpenEvaluations(
  me: Me,
  search: Readonly<Record<string, string | undefined>>,
  activeCenter?: string,
) {
  const center = search["center"] ?? (activeCenter || undefined);
  const hasAction = me.permissions.some((code) =>
    ["evaluation.create", "evaluation.read"].includes(code),
  );
  return (
    hasAction &&
    hasCenterScope(me.scope) &&
    isOptionalScopeAllowed(me.scope.centers, center) &&
    isOptionalScopeAllowed(me.scope.quadrants, search["quadrant"]) &&
    (!search["item"] || (isUuid(search["item"]) && me.permissions.includes("evaluation.read")))
  );
}
