import type { Attachments } from "../../attachments/create-attachments.ts";
import type { SqlStatement } from "../../db/sql.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import { IncidentError, MAX_INCIDENT_EVIDENCE } from "./domain.ts";
import type { IncidentDraft } from "./types.ts";
import type { IncidentStore } from "./store.ts";
interface Input {
  readonly store: IncidentStore;
  readonly attachments: Attachments;
  readonly draft: IncidentDraft;
  readonly guards: readonly SqlStatement[];
  readonly assertIdentity: () => void;
  readonly isSelected: () => boolean;
  readonly photo: EvidencePort;
}
/** Camera/file work stays outside queues; only original raw-draft/scope predicates publish its result. */
export async function captureIncidentPhoto(input: Input): Promise<void> {
  if (input.draft.evidence.length >= MAX_INCIDENT_EVIDENCE)
    throw new IncidentError("evidence_limit");
  const guard = {
    sql: `SELECT 1 WHERE ${input.guards.map((row) => `EXISTS(${row.sql})`).join(" AND ")}`,
    params: input.guards.flatMap((row) => row.params ?? []),
  };
  const assertCurrent = async () => {
    input.assertIdentity();
    if (!input.isSelected() || !(await input.store.db.query(guard.sql, guard.params)).length)
      throw new IncidentError("stale_draft");
  };
  const captured = await input.attachments.capture.capture(input.photo, {
    draftId: input.draft.eventId,
    signal: new AbortController().signal,
    guard,
    assertCurrent,
  });
  if (!captured) return;
  await assertCurrent();
  await input.store.update(
    {
      ...input.draft,
      evidence: [...input.draft.evidence, { id: captured.id, fileRef: captured.fileRef }],
    },
    [guard, captured.authority],
  );
}
