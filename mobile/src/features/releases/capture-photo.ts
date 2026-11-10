import type { Attachments } from "../../attachments/create-attachments.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import type { ReleaseStore } from "./store.ts";
import type { ReleaseWriteContext } from "./service.ts";
import { ReleaseError } from "./types.ts";

interface Input {
  readonly store: ReleaseStore;
  readonly attachments: Attachments;
  readonly photo: EvidencePort;
  readonly context: ReleaseWriteContext;
  readonly assertIdentity: () => void;
  readonly isCurrent: () => boolean;
}
/** Camera I/O never holds the edit/projection queues; adoption is checked against its original draft. */
export async function captureReleasePhoto(input: Input): Promise<void> {
  const guard = {
    sql: `SELECT 1 WHERE ${input.context.guards.map(({ sql }) => `EXISTS(${sql})`).join(" AND ")}`,
    params: input.context.guards.flatMap(({ params }) => params ?? []),
  };
  const assertCurrent = async () => {
    input.assertIdentity();
    if (!input.isCurrent() || !(await input.store.db.query(guard.sql, guard.params)).length)
      throw new ReleaseError("stale_draft");
  };
  const photo = await input.attachments.capture.capture(input.photo, {
    draftId: input.context.draft.eventId,
    signal: new AbortController().signal,
    guard,
    assertCurrent,
  });
  if (!photo) return;
  await assertCurrent();
  await input.store.update(
    {
      ...input.context.draft,
      evidence: [...input.context.draft.evidence, { id: photo.id, fileRef: photo.fileRef }],
    },
    [guard, photo.authority],
  );
}
