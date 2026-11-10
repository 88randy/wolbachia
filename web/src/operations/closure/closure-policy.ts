import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
export type Readiness = Schemas["QuadrantReadiness"];
export type Quadrant = Schemas["Quadrant"];
const BLOCKER_KEYS: Readonly<Record<string, MessageKey>> = {
  removal_unconfirmed: "closure.blocker.removalUnconfirmed",
  removal_unrecovered: "closure.blocker.removalUnrecovered",
  relocation_pending: "closure.blocker.relocationPending",
  removal_review_pending: "closure.blocker.removalReviewPending",
  relocation_review_pending: "closure.blocker.relocationReviewPending",
  incident_quadrant_closure: "closure.blocker.incidentQuadrantClosure",
};
export function blockerKey(reason: string): MessageKey {
  return BLOCKER_KEYS[reason] ?? "closure.blocker.unknown";
}
export function readinessKey(readiness: Readiness): MessageKey {
  if (readiness.is_closed) return "closure.readiness.closed";
  return readiness.can_close ? "closure.readiness.ready" : "closure.readiness.blocked";
}
/** Independent blockers are never inferred resolved from a positive aggregate flag. */
export function matchesEpoch(readiness: Readiness, quadrant: Quadrant): boolean {
  return (
    readiness.quadrant_id === quadrant.id &&
    readiness.quadrant_version_id === quadrant.current_version?.id &&
    readiness.revision === quadrant.current_version.revision
  );
}
export function isClosureReady(readiness: Readiness, quadrant: Quadrant): boolean {
  return (
    matchesEpoch(readiness, quadrant) &&
    !readiness.is_closed &&
    readiness.closure === null &&
    readiness.can_close &&
    readiness.blockers.length === 0
  );
}
