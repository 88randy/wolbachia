import { PendingDraftError } from "../ovitrap-check/ports.ts";
import { ShiftBlockedError } from "../ovitrap-check/shift-authorization.ts";
import { UUID_PATTERN } from "../ovitrap-check/domain.ts";
import type { Dependencies } from "./ports.ts";
import type { LifecycleDraft, LifecycleKind, StoredLifecycle } from "./types.ts";
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
} as const;
function pendingDraft(
  current: StoredLifecycle,
  input: StartInput,
  shiftId: string,
): LifecycleDraft | null {
  if (!current.draft || current.draft.shiftId !== shiftId || current.event) return null;
  if (current.draft.kind !== input.kind || current.draft.ovitrapId !== input.ovitrapId)
    throw new PendingDraftError();
  return current.draft;
}
async function newIdentity(deps: Dependencies, kind: LifecycleKind) {
  const eventId = deps.uuid();
  const replacementId = kind === "replace" ? deps.uuid() : null;
  if (!UUID_PATTERN.test(eventId)) throw new Error("Invalid event UUID.");
  if (
    replacementId &&
    (!UUID_PATTERN.test(replacementId) ||
      replacementId === eventId ||
      (await deps.store.physical(replacementId)))
  )
    throw new Error("New physical identity must be unused.");
  return { eventId, replacementId };
}
export async function startDraft(
  deps: Dependencies,
  input: StartInput,
  current: StoredLifecycle,
): Promise<LifecycleDraft> {
  const shiftId = await deps.shiftId();
  if (!shiftId) throw new ShiftBlockedError();
  const pending = pendingDraft(current, input, shiftId);
  if (pending) return pending;
  const source = await deps.store.physical(input.ovitrapId);
  const { assignment } = await deps.store.capture.snapshots();
  if (
    !source ||
    source.isRetired ||
    !assignment?.points.some((point) => point.id === source.point.id)
  )
    throw new Error("No authorized active physical ovitrap.");
  return {
    ...EMPTY,
    ...(await deps.store.configuration()),
    ...(await newIdentity(deps, input.kind)),
    deviceTime: deps.now().toISOString(),
    shiftId,
    kind: input.kind,
    ovitrapId: source.id,
    point: source.point,
    assignment,
    manualCapture: input.manualCapture,
  };
}
