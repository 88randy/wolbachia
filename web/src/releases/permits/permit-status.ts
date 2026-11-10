import type { MessageKey } from "@wolbachia/i18n";
import type { Tone } from "../../ui/tone";

export type PermitStatus = "valid" | "suspended" | "expired" | "unavailable";

interface Blocker {
  reason: string;
}

/** The status is read from the server's `blocked_by`; the browser never recomputes validity. */
export function permitStatus(blockedBy: readonly Blocker[]): PermitStatus {
  const reasons = new Set(blockedBy.map((blocker) => blocker.reason));
  if (reasons.has("permit_suspended")) return "suspended";
  if (reasons.has("permit_unavailable")) return "unavailable";
  if (reasons.has("permit_expired")) return "expired";
  return "valid";
}

export const STATUS_TONE: Record<PermitStatus, Tone> = {
  valid: "success",
  suspended: "critical",
  expired: "warning",
  unavailable: "neutral",
};

const BLOCKER_KEYS: Record<string, MessageKey> = {
  permit_suspended: "permits.blocker.permitSuspended",
  permit_expired: "permits.blocker.permitExpired",
  permit_unavailable: "permits.blocker.permitUnavailable",
};

/** Backend blocker reason to its catalog text; an unknown reason gets the generic text. */
export function blockerKey(reason: string): MessageKey {
  return BLOCKER_KEYS[reason] ?? "permits.blocker.other";
}
