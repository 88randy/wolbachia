import { UUID_PATTERN, visibleLength } from "../ovitrap-check/domain.ts";
import { reviewReasons as captureReviewReasons } from "../ovitrap-check/review-policy.ts";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import type { LifecycleDraft } from "./types.ts";
export const MAX_EVIDENCE = 100;
export const MAX_OTHER = 1000;
export function needsOther(draft: LifecycleDraft): boolean {
  return (
    draft.catalog?.[draft.kind].find((item) => item.code === draft.reasonCode)?.is_other === true
  );
}
function validOther(draft: LifecycleDraft): boolean {
  const text = draft.otherText.normalize("NFC").trim();
  if (!needsOther(draft)) return !text;
  return (
    visibleLength(text) > 0 &&
    Array.from(text).length <= MAX_OTHER &&
    !/[\p{Cc}\p{Cs}\u202a-\u202e\u2066-\u2069]/u.test(text.replaceAll("\n", ""))
  );
}
export function reviewReasons(draft: LifecycleDraft, now: Date): readonly string[] {
  return captureReviewReasons(
    { point: draft.point, gps: draft.gps, rules: draft.rules, mode: "check" },
    now,
  );
}
function contextGate(draft: LifecycleDraft): string | null {
  if (
    !draft.catalog?.version ||
    !draft.catalog[draft.kind].some((item) => item.code === draft.reasonCode)
  )
    return "reason";
  if (!draft.rules?.version || draft.rules.isConfigured === false) return "rules";
  if (!draft.assignment.points.some((point) => point.id === draft.point.id)) return "scope";
  return validOther(draft) ? null : "other";
}
function evidenceGate(draft: LifecycleDraft): string | null {
  if (!draft.evidence.length || draft.evidence.length > MAX_EVIDENCE) return "evidence";
  return draft.evidence.every((item) => UUID_PATTERN.test(item.id) && item.fileRef.trim())
    ? null
    : "evidence";
}
function physicalGate(draft: LifecycleDraft): string | null {
  if (!draft.gps || (draft.kind === "relocate" && !draft.proposedLocation)) return "gps";
  if (draft.kind === "replace" && (!draft.replacementId || !UUID_PATTERN.test(draft.replacementId)))
    return "identity";
  if (
    draft.kind === "remove" &&
    !["recovered", "unrecovered", "unconfirmed"].some((state) => state === draft.recovery)
  )
    return "recovery";
  return null;
}
function policyGate(draft: LifecycleDraft, now: Date): string | null {
  const reasons = reviewReasons(draft, now);
  if (reasons.includes("gps") && draft.rules?.gpsPolicy !== "review") return "review";
  if (reasons.includes("stale") && draft.rules?.stalePolicy !== "review") return "rules";
  return reasons.length && !draft.reviewAcknowledged ? "review" : null;
}
export function saveGate(draft: LifecycleDraft, now: Date): string | null {
  return contextGate(draft) ?? physicalGate(draft) ?? evidenceGate(draft) ?? policyGate(draft, now);
}
/** Only a durable per-event server result proves receipt; pending/error is never delivery. */
export function deliveryState(event: OutboxEvent | null) {
  const hasReceipt = Boolean(
    event?.result && ["sent", "in_review", "rejected"].includes(event.status),
  );
  return {
    phone: event ? ("saved" as const) : ("draft" as const),
    server: hasReceipt ? ("received" as const) : ("pending" as const),
    review: hasReceipt ? (event?.status === "sent" ? "accepted" : event?.status) : "unknown",
  };
}
