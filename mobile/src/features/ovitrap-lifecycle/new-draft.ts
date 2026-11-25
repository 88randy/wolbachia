import { PendingDraftError } from "../ovitrap-check/ports.ts";
import { ShiftBlockedError } from "../ovitrap-check/shift-authorization.ts";
import type { Dependencies } from "./ports.ts";
import type {
  CurrentLifecycleDraft,
  LifecycleDraft,
  LifecycleKind,
  StoredLifecycle,
  LifecycleSource,
} from "./types.ts";
export interface StartInput {
  readonly kind: LifecycleKind;
  readonly ovitrapId: string;
  readonly manualCapture: boolean;
}
const EMPTY = {
  gps: null,
  proposedLocation: null,
  reasonCode: "",
  otherText: "",
  recovery: null,
  evidence: [],
  discardedEvidence: [],
  reviewAcknowledged: false,
  // Replacing: the new trap's label is bound later by scanning or typing its sticker.
  replacementId: null,
  labelScanned: false,
  replacementCode: null,
} as const;
export function pendingDraft(
  current: StoredLifecycle,
  input: StartInput,
  shiftId: string,
): LifecycleDraft | null {
  if (!current.draft || current.draft.shiftId !== shiftId || current.event) return null;
  if (current.draft.kind !== input.kind || current.draft.ovitrapId !== input.ovitrapId)
    throw new PendingDraftError();
  return current.draft;
}
/** Only the explicit new-start writer supplies the fresh event UUID and validated original source. */
function requireActiveSource(source: LifecycleSource, ovitrapId: string): void {
  if (source.isRetired || source.physical.id !== ovitrapId || source.epoch.is_closed !== false)
    throw new Error("No authorized active physical ovitrap.");
}
export async function startDraft(
  deps: Dependencies,
  input: StartInput & {
    readonly source: LifecycleSource;
    readonly freshEventId: string;
    readonly deviceTime: string;
  },
): Promise<CurrentLifecycleDraft> {
  const { source, freshEventId, deviceTime } = input;
  const shiftId = await deps.shiftId();
  if (!shiftId) throw new ShiftBlockedError();
  requireActiveSource(source, input.ovitrapId);
  const { catalog, rules, limits, ...audit } = source;
  return {
    ...EMPTY,
    catalog,
    rules,
    ...(limits === undefined ? {} : { limits }),
    eventId: freshEventId,
    schemaVersion: 2,
    source: audit,
    deviceTime,
    shiftId,
    kind: input.kind,
    ovitrapId: source.physical.id,
    point: source.point,
    manualCapture: input.manualCapture,
  };
}
