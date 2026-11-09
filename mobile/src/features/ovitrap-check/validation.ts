import { captureWeek } from "./capture-week.ts";
import type { Draft } from "./types.ts";
import {
  canReuse,
  needsOther,
  PLACEMENT_PREPARATION,
  PREPARATION,
  NO_PADDLE_FINDINGS,
  UUID_PATTERN,
  validReason,
  visibleLength,
} from "./domain.ts";
import { reviewReasons } from "./review-policy.ts";
export { reviewReasons } from "./review-policy.ts";
export type Gate =
  | "weekContext"
  | "shift"
  | "assignment"
  | "catalog"
  | "rules"
  | "point"
  | "finding"
  | "paddle"
  | "eggs"
  | "bag"
  | "conditions"
  | "other"
  | "prepare"
  | "evidence"
  | "reuse"
  | "reason"
  | "review";
function paddleGate(draft: Draft): Gate | null {
  if (draft.paddlePresent === null) return "paddle";
  if (!draft.paddlePresent) return null;
  if (typeof draft.hasEggs !== "boolean") return "eggs";
  if (!draft.catalog?.paddleTypes.some((item) => item.code === draft.paddleType)) return "paddle";
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(draft.bagCode) ? null : "bag";
}
function conditionGate(draft: Draft): Gate | null {
  if (draft.temperature.trim() && !Number.isFinite(Number(draft.temperature))) return "conditions";
  if (
    draft.humidity.trim() &&
    (!Number.isFinite(Number(draft.humidity)) ||
      Number(draft.humidity) < 0 ||
      Number(draft.humidity) > 100)
  )
    return "conditions";
  return null;
}
function correctionGate(draft: Draft): Gate | null {
  if (!draft.replacesEventId) return null;
  if (
    !draft.catalog?.voidReasons.some((item) => item.code === draft.reasonCode) ||
    !validReason(draft.reason)
  )
    return "reason";
  return null;
}
function policyGate(draft: Draft, now: Date): Gate | null {
  const reasons = reviewReasons(draft, now);
  if (reasons.includes("gps") && draft.rules?.gpsPolicy !== "review") return "review";
  if (reasons.includes("stale") && draft.rules?.stalePolicy !== "review") return "rules";
  return reasons.length && !draft.reviewAcknowledged ? "review" : null;
}
function preparationGate(draft: Draft): Gate | null {
  const required = draft.mode === "place" ? PLACEMENT_PREPARATION : PREPARATION;
  const shouldPrepare = draft.mode === "place" || !NO_PADDLE_FINDINGS.includes(draft.finding);
  if (shouldPrepare && required.some((key) => !draft.prepared.includes(key))) return "prepare";
  if (
    draft.reuseId &&
    !canReuse(
      draft.assignment?.reuse.find((item) => item.id === draft.reuseId),
      draft.rules?.maxPaddleReuses ?? 2,
    )
  )
    return "reuse";
  return null;
}
function referencesGate(draft: Draft): Gate | null {
  if (draft.supplyRefs.length > 100 || draft.evidence.length > 100) return "point";
  if (!draft.supplyRefs.every((id) => UUID_PATTERN.test(id))) return "point";
  if (!draft.evidence.every((item) => UUID_PATTERN.test(item.id) && item.fileRef.trim()))
    return "evidence";
  return null;
}
function captureGate(draft: Draft): Gate | null {
  if (draft.mode === "place")
    return draft.point && UUID_PATTERN.test(draft.point.id) ? referencesGate(draft) : "point";
  if (!draft.catalog?.findings.some((item) => item.code === draft.finding)) return "finding";
  return paddleGate(draft) ?? conditionGate(draft);
}
function scopeGate(draft: Draft): Gate | null {
  if (!draft.assignment?.version || !draft.assignment.epiWeek || !draft.assignment.points.length)
    return "assignment";
  if (draft.point && !draft.assignment.points.some((point) => point.id === draft.point?.id))
    return "point";
  return null;
}
function contextGate(draft: Draft): Gate | null {
  if (!draft.shiftId) return "shift";
  if (!draft.catalog?.version) return "catalog";
  if (!draft.rules?.version || draft.rules.isConfigured === false) return "rules";
  return null;
}
export function requiresPhoto(draft: Draft): boolean {
  return Boolean(
    draft.catalog?.findings.find((item) => item.code === draft.finding)?.requires_photo ||
    draft.catalog?.paddleTypes.find((item) => item.code === draft.paddleType)?.requires_photo,
  );
}
function evidenceGate(draft: Draft): Gate | null {
  if (needsOther(draft) && (visibleLength(draft.otherText) < 1 || draft.otherText.length > 1000))
    return "other";
  return requiresPhoto(draft) && !draft.evidence.length ? "evidence" : null;
}
/** Missing configuration blocks. Policy review requires an explicit acknowledgement, never a compliance claim. */
export function saveGate(draft: Draft, now: Date): Gate | null {
  return (
    contextGate(draft) ??
    scopeGate(draft) ??
    (captureWeek(draft) ? null : "weekContext") ??
    evidenceGate(draft) ??
    captureGate(draft) ??
    preparationGate(draft) ??
    correctionGate(draft) ??
    policyGate(draft, now)
  );
}
