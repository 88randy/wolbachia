import type { Draft, QrKind, Reuse, Step } from "./types.ts";
export type { Draft, DraftPatch } from "./types.ts";
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QR_PATTERN =
  /^wbf:1:(lot|ovitrap|bag|release-device|sample):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
export const NO_PADDLE_FINDINGS = [
  "closed-house",
  "absent",
  "missing",
  "destroyed",
  "no-paddle",
  "abandoned",
  "removed",
];
export const PREPARATION = ["clean", "water", "liner"] as const;
export const PLACEMENT_PREPARATION = [
  ...PREPARATION,
  "shade",
  "height",
  "containers",
  "safe",
  "marked",
] as const;
/** Scans have one strict interpretation. Explicit manual entry is a separate action. */
export function parseQr(value: string, expected?: QrKind): { kind: QrKind; id: string } | null {
  const match = QR_PATTERN.exec(value);
  if (!match || match[0] !== value || (expected && match[1] !== expected) || !match[2]) return null;
  return { kind: match[1] as QrKind, id: match[2].toLowerCase() };
}
export function normalizePaddle(draft: Draft): Draft {
  const isAbsent = NO_PADDLE_FINDINGS.includes(draft.finding);
  if (!isAbsent && draft.paddlePresent !== false) return draft;
  return {
    ...draft,
    paddlePresent: false,
    hasEggs: null,
    paddleType: null,
    bagCode: "",
    bagUuid: null,
  };
}
export function canReuse(reuse: Reuse | undefined, maximum: number): boolean {
  return Boolean(
    reuse?.isEligible &&
    Number.isInteger(reuse.reuses) &&
    reuse.reuses >= 0 &&
    reuse.reuses < Math.min(maximum, 2),
  );
}
/** Same visible-character boundary as the backend: normalize, reject controls/bidi, exclude format/marks/separators. */
export function validReason(reason: string): boolean {
  const normalized = reason.normalize("NFC").replaceAll("\r\n", "\n").trim();
  if (
    Array.from(normalized).length > 1000 ||
    /[\p{Cs}\u202a-\u202e\u2066-\u2069]/u.test(normalized)
  )
    return false;
  if (/\p{Cc}/u.test(normalized.replaceAll("\n", ""))) return false;
  return visibleLength(normalized) >= 10;
}
export function visibleLength(value: string): number {
  return Array.from(
    value
      .normalize("NFC")
      .replace(/[\p{Z}\p{Mn}\p{Me}\p{Cf}\p{Cc}\p{Co}\p{Cn}\u115f\u1160\u3164\uffa0\u2800]/gu, ""),
  ).length;
}
export function needsOther(draft: Draft): boolean {
  return Boolean(
    draft.catalog?.findings.find((item) => item.code === draft.finding)?.is_other ||
    draft.catalog?.paddleTypes.find((item) => item.code === draft.paddleType)?.is_other,
  );
}
/** Explicit whitelist: local provenance never leaks into the strict backend payload. */
export function checkPayload(draft: Draft): Record<string, unknown> {
  const normalized = normalizePaddle(draft);
  return {
    ovitrap_id: normalized.ovitrapId,
    finding: normalized.finding,
    paddle_present: normalized.paddlePresent,
    has_eggs: normalized.hasEggs,
    temperature_c: normalized.temperature.trim() ? Number(normalized.temperature) : null,
    humidity_pct: normalized.humidity.trim() ? Number(normalized.humidity) : null,
    paddle_type: normalized.paddleType,
    is_lagged: normalized.isLagged,
    bag_code: normalized.bagCode || null,
    evidence_ids: normalized.evidence.map((item) => item.id),
    ...(needsOther(normalized) ? { other_text: normalized.otherText.trim() } : {}),
  };
}
export function placePayload(draft: Draft): Record<string, unknown> {
  return {
    sampling_point_id: draft.point?.id,
    ovitrap_id: draft.ovitrapId,
    supply_refs: draft.supplyRefs,
    evidence_ids: draft.evidence.map((item) => item.id),
  };
}
/** The UI uses these same automatic transitions after a choice. */
export function nextCheckStep(draft: Pick<Draft, "step" | "finding" | "paddlePresent">): Step {
  if (draft.step === "finding")
    return NO_PADDLE_FINDINGS.includes(draft.finding) ? "confirm" : "paddle";
  if (draft.step === "paddle") return draft.paddlePresent ? "eggs" : "details";
  if (draft.step === "eggs") return "details";
  return "confirm";
}
/** Walk the same automatic step transitions used by choice handlers. Count control taps only. */
export function measureCheckTaps(path: "normal" | "closed-house"): number {
  let draft: Pick<Draft, "step" | "finding" | "paddlePresent"> = {
    step: "finding",
    finding: path === "normal" ? "intact" : "closed-house",
    paddlePresent: true,
  };
  let taps = 0;
  while (draft.step !== "confirm") {
    // Details: type, bag scan, each preparation confirmation, then Continue.
    taps += draft.step === "details" ? 2 + PREPARATION.length + 1 : 1;
    draft = { ...draft, step: nextCheckStep(draft) };
  }
  return taps + 1;
}
