import type { Schemas } from "@wolbachia/api-client";
import type { ReceiptDraft } from "./receipt-types.ts";
import { ReceiptError } from "./domain.ts";
import { needsPhoneSignature } from "./signature-need.ts";
import type { SignatureMode } from "./signature-need.ts";
import type { ReceiptLine } from "./receipt-types.ts";

interface Input {
  readonly assignment: Schemas["SupplyBundle"];
  readonly releaseId: string;
  readonly ownerKey: string;
  readonly shiftId: string;
  readonly versions: {
    readonly rules: string;
    readonly catalog: string;
    readonly signatureMode?: SignatureMode;
  };
  readonly now: Date;
  readonly uuid: () => string;
}
/** Pin original release quantities/identities before any edit, signature or network turn. */
export function newReceiptDraft(input: Input): ReceiptDraft {
  const { assignment, uuid } = input;
  const release = assignment.releases.find((row) => row.id === input.releaseId);
  if (!release || release.plan_revision !== assignment.revision) throw new ReceiptError("scope");
  if (!input.versions.catalog || !input.versions.rules) throw new ReceiptError("configuration");
  const lines = receiptLines({ assignment, release, uuid });
  return {
    eventId: uuid(),
    assignmentId: assignment.id,
    releaseId: release.id,
    planRevision: assignment.revision,
    expectedRevision: assignment.reconciliation?.revision ?? 0,
    ownerKey: input.ownerKey,
    shiftId: input.shiftId,
    deviceTime: input.now.toISOString(),
    manualCapture: false,
    scannedIds: [],
    catalogVersion: input.versions.catalog,
    rulesVersion: input.versions.rules,
    lines,
    discrepancy: null,
    strokes: [],
    signature: null,
    needsSignature: needsPhoneSignature(
      input.versions.signatureMode ?? 0,
      release.warehouse_signed
        ? { state: "signed", channel: "warehouse_screen" }
        : { state: "pending_phone", channel: null },
    ),
    evidence: [],
  };
}
function receiptLines(input: {
  assignment: Schemas["SupplyBundle"];
  release: Schemas["SupplyReleaseBundle"];
  uuid: () => string;
}): readonly ReceiptLine[] {
  return input.release.lines.map((line) => {
    const original = input.assignment.lines.find((row) => row.id === line.assignment_line_id);
    if (!original) throw new ReceiptError("scope");
    return {
      id: input.uuid(),
      releaseLineId: line.id,
      lotId: original.lot_id,
      pieceId: original.piece_id ?? null,
      unitVersionId: original.unit_version_id,
      expected: line.quantity,
      quantity: "0",
    };
  });
}
