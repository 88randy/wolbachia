import type { Attachments } from "../../attachments/create-attachments.ts";
import type { SqlStatement } from "../../db/sql.ts";
import type { CapturedEvidence, EvidencePort } from "../ovitrap-check/types.ts";
import { ReceiptError } from "./domain.ts";
import type { ReceiptStore } from "./store.ts";
import type { ReceiptDraft } from "./receipt-types.ts";
interface Input {
  readonly store: ReceiptStore;
  readonly attachments: Attachments;
  readonly draft: ReceiptDraft;
  readonly guards: readonly SqlStatement[];
  readonly assertIdentity: () => void;
  readonly isSelected: () => boolean;
  readonly port: EvidencePort;
  readonly isSignature: boolean;
}
function captureGuard(guards: readonly SqlStatement[]): SqlStatement {
  return {
    sql: `SELECT 1 WHERE ${guards.map((row) => `EXISTS(${row.sql})`).join(" AND ")}`,
    params: guards.flatMap((row) => row.params ?? []),
  };
}
function capturedDraft(input: Input, captured: CapturedEvidence): ReceiptDraft {
  const evidence = { id: captured.id, fileRef: captured.fileRef };
  return {
    ...input.draft,
    ...(input.isSignature
      ? { signature: evidence }
      : { signature: null, evidence: [...input.draft.evidence, evidence] }),
  };
}
/** File/native continuations retain the ORIGINAL raw draft/source guards; no reauthorization by reread. */
export async function captureReceipt(input: Input): Promise<void> {
  const guard = captureGuard(input.guards);
  const assertCurrent = async () => {
    input.assertIdentity();
    if (!input.isSelected()) throw new ReceiptError("stale_draft");
    const rows = await input.store.db.query(guard.sql, guard.params);
    if (!rows.length) throw new ReceiptError("stale_draft");
  };
  const captured = await input.attachments.capture.capture(input.port, {
    draftId: input.draft.eventId,
    signal: new AbortController().signal,
    guard,
    assertCurrent,
  });
  if (captured === null) return;
  await assertCurrent();
  await input.store.update(capturedDraft(input, captured), [guard, captured.authority]);
}
