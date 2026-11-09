import { PendingDraftError } from "../ovitrap-check/ports.ts";
import { ShiftBlockedError } from "../ovitrap-check/shift-authorization.ts";
import { UUID_PATTERN } from "../ovitrap-check/domain.ts";
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
async function replacementIdentity(deps: Dependencies, kind: LifecycleKind, eventId: string) {
  const id = kind === "replace" ? deps.uuid() : null;
  if (
    id &&
    (!UUID_PATTERN.test(id) ||
      id === eventId ||
      (await deps.store.physical(id)) ||
      (
        await deps.store.db.query(
          "SELECT 1 FROM lifecycle_courier_projection WHERE kind='ovitrap' AND id=?",
          [id],
        )
      ).length)
  )
    throw new Error("New physical identity must be unused.");
  return id;
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
    replacementId: await replacementIdentity(deps, input.kind, freshEventId),
    deviceTime,
    shiftId,
    kind: input.kind,
    ovitrapId: source.physical.id,
    point: source.point,
    manualCapture: input.manualCapture,
  };
}
