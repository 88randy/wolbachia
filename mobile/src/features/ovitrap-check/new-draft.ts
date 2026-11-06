import type { Draft } from "./types.ts";
import type { Snapshots } from "./store.ts";
interface Input {
  readonly uuid: () => string;
  readonly now: Date;
  readonly snapshots: Snapshots;
  readonly shiftId: string;
  readonly mode: Draft["mode"];
  readonly ovitrapId?: string;
}
export const EMPTY_ANSWERS = {
  finding: "",
  paddlePresent: null,
  hasEggs: null,
  temperature: "",
  humidity: "",
  paddleType: null,
  bagCode: "",
  bagQrHistory: [],
  bagUuid: null,
  isLagged: false,
  otherText: "",
  supplyRefs: [],
  sourceEvidence: [],
  evidence: [],
  prepared: [],
  reuseId: null,
  reviewAcknowledged: false,
  replacesEventId: null,
  voidEventId: null,
  reasonCode: "",
  reason: "",
} as const;
export function newDraft(input: Input): Draft {
  return {
    eventId: input.uuid(),
    deviceTime: input.now.toISOString(),
    mode: input.mode,
    ovitrapId: input.ovitrapId ?? input.uuid(),
    shiftId: input.shiftId,
    ...input.snapshots,
    point: null,
    gps: null,
    manualCapture: false,
    step: input.mode === "place" ? "point" : "finding",
    ...EMPTY_ANSWERS,
  };
}
