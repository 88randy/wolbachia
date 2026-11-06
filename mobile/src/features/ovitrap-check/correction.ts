import type { Draft } from "./types.ts";
/** Copy answers and source evidence, never a previous visit's GPS, scope, session or acknowledgement. */
export function correctionDraft(current: Draft, source: Draft, voidEventId: string): Draft {
  return {
    ...current,
    // Reserve 1 ms for the void and stay after the accepted source even if the clock stalls.
    deviceTime: new Date(
      Math.max(Date.parse(current.deviceTime), Date.parse(source.deviceTime) + 2),
    ).toISOString(),
    finding: source.finding,
    paddlePresent: source.paddlePresent,
    hasEggs: source.hasEggs,
    temperature: source.temperature,
    humidity: source.humidity,
    paddleType: source.paddleType,
    isLagged: source.isLagged,
    otherText: source.otherText,
    sourceEvidence: [...source.sourceEvidence, ...source.evidence],
    evidence: [],
    bagCode: "",
    bagUuid: null,
    prepared: [],
    reuseId: null,
    step: "finding",
    reviewAcknowledged: false,
    replacesEventId: source.eventId,
    voidEventId,
  };
}
