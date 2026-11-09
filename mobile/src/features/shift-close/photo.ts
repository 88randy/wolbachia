import { requireCaptureSignal } from "../../attachments/capture-signal.ts";
import type { Attachments } from "../../attachments/create-attachments.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import type { CloseDraft } from "./domain.ts";
import type { ShiftCloseStore } from "./store.ts";
import type { SqlStatement } from "../../db/sql.ts";
interface PhotoInput {
  readonly store: ShiftCloseStore;
  readonly draft: CloseDraft;
  readonly eventId: string;
  readonly attachments: Attachments;
  readonly port: EvidencePort;
  readonly signal: AbortSignal;
  readonly assertCurrent: () => void;
  readonly sourceGuard: SqlStatement;
}
function captureGuard({ draft, sourceGuard }: PhotoInput) {
  return {
    sql: `SELECT 1 FROM lifecycle_courier_projection WHERE kind='local.shift-close'
      AND id=? AND body=? AND EXISTS(${sourceGuard.sql})`,
    params: [draft.shiftId, JSON.stringify(draft), ...(sourceGuard.params ?? [])],
  };
}
/** Native/file work holds no projection lock; only the original JSON may publish the adopted file. */
export async function captureClosePhoto(input: PhotoInput): Promise<void> {
  const { store, draft, attachments, eventId, signal } = input;
  const guard = captureGuard(input);
  const assertCurrent = async () => {
    input.assertCurrent();
    requireCaptureSignal(signal);
    if (!(await store.db.query(guard.sql, guard.params)).length)
      throw new Error("Closing photo context changed.");
    input.assertCurrent();
  };
  const photo = await attachments.capture.capture(input.port, {
    draftId: eventId,
    signal,
    assertCurrent,
    guard,
  });
  if (photo === null) return;
  await assertCurrent();
  const supplies = draft.supplies.map((supply) =>
    supply.eventId === eventId
      ? { ...supply, photos: [...(supply.photos ?? []), { id: photo.id, fileRef: photo.fileRef }] }
      : supply,
  );
  const publicationGuard = {
    sql: `SELECT 1 WHERE EXISTS(${photo.authority.sql}) AND EXISTS(${input.sourceGuard.sql})`,
    params: [...(photo.authority.params ?? []), ...(input.sourceGuard.params ?? [])],
  };
  await store.db.runAtomically([store.replace(draft, { ...draft, supplies }, publicationGuard)]);
}
