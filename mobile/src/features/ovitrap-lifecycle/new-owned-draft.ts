import { ownerKey } from "../../attachments/types.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import type { SqlStatement } from "../../db/sql.ts";
import { readUuid } from "./contract-readers.ts";
import { requireCurrentDraft } from "./draft-context.ts";
import { captureContextCas } from "./context-state.ts";
import { CURRENT_CAPTURE_CONTEXT, capturePointScopeSql } from "./context-sql.ts";
import type { CaptureTransportHandle } from "./capture-context-contract.ts";
import type { LifecycleDraft, CurrentLifecycleDraft } from "./types.ts";
import type { LifecycleStore } from "./store.ts";
interface NewDraftInput {
  readonly store: LifecycleStore;
  readonly handle: CaptureTransportHandle;
  readonly expectedEventId: string | null;
  readonly uuid: () => string;
  readonly create: (freshEventId: string) => Promise<CurrentLifecycleDraft>;
  readonly ownerFence: EvidenceFence;
  readonly admit: <T>(commit: () => Promise<T>) => Promise<T>;
}
function freshIdentity(eventId: string): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_guard(slot,value) VALUES(1,CASE WHEN NOT EXISTS(
    SELECT 1 FROM outbox_event WHERE id=? UNION ALL SELECT 1 FROM lifecycle_archive WHERE event_id=?
    UNION ALL SELECT 1 FROM lifecycle_capture WHERE event_id=?
    UNION ALL SELECT 1 FROM lifecycle_identity WHERE event_id=?
    UNION ALL SELECT 1 FROM lifecycle_draft WHERE json_extract(draft,'$.eventId')=?
    UNION ALL SELECT 1 FROM ovitrap_draft WHERE json_extract(draft,'$.eventId')=?
    UNION ALL SELECT 1 FROM ovitrap_superseded_draft WHERE event_id=?) THEN 1 ELSE 0 END)
    ON CONFLICT(slot) DO UPDATE SET value=excluded.value`,
    params: Array.from({ length: 7 }, () => eventId),
  };
}
function ownedDraftStatement(draft: LifecycleDraft, handle: CaptureTransportHandle): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body)
    SELECT 'lifecycle.owned-draft',?,'local-origin-v1',0,
      json_object('sourceEventId',?,'pointId',?,'ovitrapId',?,'kind',?,'draftSchemaVersion',2,'owner',json_extract(value,'$.owner'),
        'ownerKey',json_extract(value,'$.ownerKey'),'captureSessionId',json_extract(value,'$.sessionId'),
        'captureRevision',json_extract(value,'$.authorityRevision'),'context',json_extract(value,'$.context'))
    FROM (${CURRENT_CAPTURE_CONTEXT}) WHERE json_extract(value,'$.ownerKey')=?
      AND json_extract(value,'$.sessionId')=? AND json_extract(value,'$.authorityRevision')=?
      AND EXISTS(${capturePointScopeSql("?")})`,
    params: [
      draft.eventId,
      draft.eventId,
      draft.point.id,
      draft.ovitrapId,
      draft.kind,
      ownerKey(handle.owner),
      handle.sessionId,
      handle.revision,
      draft.point.id,
    ],
  };
}
function requireOwnedDraft(eventId: string): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_guard(slot,value) VALUES(1,CASE WHEN EXISTS(
      SELECT 1 FROM lifecycle_courier_projection WHERE kind='lifecycle.owned-draft' AND id=?) THEN 1 ELSE 0 END)
    ON CONFLICT(slot) DO UPDATE SET value=excluded.value`,
    params: [eventId],
  };
}
/** Same durable owner arbiter used by no-file origin, draft/config writes and capture commits. */
export function lifecycleCommitGuards(
  handle: CaptureTransportHandle,
  fence: EvidenceFence,
): readonly SqlStatement[] {
  if (
    !handle.isCurrent() ||
    fence.ownerKey !== ownerKey(handle.owner) ||
    fence.sessionId !== handle.sessionId
  )
    throw new Error("Capture transport changed.");
  return [
    ...captureContextCas(handle),
    {
      sql: `INSERT INTO lifecycle_guard(slot,value) VALUES(1,CASE WHEN ${CURRENT_FENCE} THEN 1 ELSE 0 END)
      ON CONFLICT(slot) DO UPDATE SET value=excluded.value`,
      params: fenceParams(fence),
    },
  ];
}
/** ONLY explicit new creation may call this. Restore/save/hydration never mint origin. M3 owns UI composition. */
export async function startOwnedLifecycleDraft(
  input: NewDraftInput,
): Promise<CurrentLifecycleDraft> {
  if (
    !input.handle.isCurrent() ||
    input.ownerFence.ownerKey !== ownerKey(input.handle.owner) ||
    input.ownerFence.sessionId !== input.handle.sessionId
  )
    throw new Error("Capture transport changed.");
  const freshEventId = readUuid(input.uuid());
  const draft = requireCurrentDraft(await input.create(freshEventId));
  if (draft.eventId !== freshEventId)
    throw new Error("New capture must use its fresh generated UUID.");
  await input.admit(() =>
    input.store.db.runAtomically([
      ...lifecycleCommitGuards(input.handle, input.ownerFence),
      freshIdentity(freshEventId),
      ownedDraftStatement(draft, input.handle),
      requireOwnedDraft(draft.eventId),
      ...input.store.beginStatements(draft, input.expectedEventId),
    ]),
  );
  return draft;
}
