import type { Attachments } from "../../attachments/create-attachments.ts";
import type { SqlStatement } from "../../db/sql.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import { FuelError } from "./domain.ts";
import type { FuelStore } from "./store.ts";
import type { FuelDraft } from "./types.ts";
interface Input {
  readonly store: FuelStore;
  readonly attachments: Attachments;
  readonly draft: FuelDraft;
  readonly guards: readonly SqlStatement[];
  readonly assertIdentity: () => void;
  readonly isSelected: () => boolean;
  readonly port: EvidencePort;
}
/** Retake changes the reference only after durable adoption and the ORIGINAL authority/draft CAS. */
export async function captureFuelReceipt(input: Input): Promise<void> {
  const guard = {
    sql: `SELECT 1 WHERE ${input.guards.map((row) => `EXISTS(${row.sql})`).join(" AND ")}`,
    params: input.guards.flatMap((row) => row.params ?? []),
  };
  const assertCurrent = async () => {
    input.assertIdentity();
    if (!input.isSelected()) throw new FuelError("stale_draft");
    if (!(await input.store.db.query(guard.sql, guard.params)).length)
      throw new FuelError("stale_draft");
  };
  const captured = await input.attachments.capture.capture(input.port, {
    draftId: input.draft.eventId,
    signal: new AbortController().signal,
    guard,
    assertCurrent,
  });
  if (captured === null) return;
  await assertCurrent();
  await input.store.update(
    { ...input.draft, receipt: { id: captured.id, fileRef: captured.fileRef } },
    [guard, captured.authority],
  );
}
