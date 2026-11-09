import { CURRENT_FENCE, fenceParams } from "./attachment-store.ts";
import type { EvidenceFence } from "./types.ts";
import type { SqlStatement } from "../db/sql.ts";
export interface EvidenceSelection {
  readonly fence: EvidenceFence | null;
  readonly isFinal: boolean;
}

// UNION deduplicates IDs even with corrupt/cyclic lineage. Edges inspect pending work only;
// ordinary historical receipts are not reclassified or scanned as dependency blockers.
const DEPENDENCIES = `edges(parent,child) AS (
 SELECT p.id,c.id FROM waiting c JOIN waiting p ON p.id=c.voids_event_id
 UNION SELECT l.target_event_id,l.void_event_id FROM ovitrap_lineage l JOIN waiting p ON p.id=l.target_event_id
 UNION SELECT l.void_event_id,l.replacement_event_id FROM ovitrap_lineage l JOIN waiting p ON p.id=l.void_event_id
 UNION SELECT p.id,c.id FROM waiting c JOIN waiting p ON p.seq<c.seq
   AND json_extract(p.payload,'$.replacement_id')=json_extract(c.payload,'$.ovitrap_id')
 UNION SELECT p.id,c.id FROM waiting c JOIN waiting p ON p.seq=(SELECT MAX(previous.seq) FROM outbox_event previous
   WHERE previous.local_status='pending' AND previous.seq<c.seq
   AND json_extract(previous.payload,'$.ovitrap_id')=json_extract(c.payload,'$.ovitrap_id'))
)`;

const UNVERIFIED_EVIDENCE = `(json_type(payload,'$.evidence_ids') IS NOT NULL AND
    (json_type(payload,'$.evidence_ids')<>'array' OR EXISTS(SELECT 1 FROM json_each(payload,'$.evidence_ids') ref
      WHERE ref.type<>'text' OR NOT EXISTS(SELECT 1 FROM attachment_file f WHERE f.id=ref.value
        AND f.state='verified' AND f.verified_at IS NOT NULL AND f.owner_key=?
        AND EXISTS(SELECT 1 FROM attachment_event b WHERE b.evidence_id=f.id AND b.event_id=waiting.id)))))
    OR (type='supplies.receive' AND NOT EXISTS(SELECT 1 FROM attachment_file f
      JOIN attachment_event b ON b.evidence_id=f.id AND b.event_id=waiting.id
      WHERE f.id=json_extract(waiting.payload,'$.signature_upload_id')
        AND f.state='verified' AND f.verified_at IS NOT NULL AND f.owner_key=?))
    OR (type='fuel.load' AND json_type(payload,'$.receipt_upload_id') IS NOT NULL
      AND json_type(payload,'$.receipt_upload_id')<>'null' AND
      (json_type(payload,'$.receipt_upload_id')<>'text' OR NOT EXISTS(SELECT 1 FROM attachment_file f
        JOIN attachment_event b ON b.evidence_id=f.id AND b.event_id=waiting.id
        WHERE f.id=json_extract(waiting.payload,'$.receipt_upload_id')
          AND f.state='verified' AND f.verified_at IS NOT NULL AND f.owner_key=?)))`;

// One SyncEngine serializes claim and receipt. Fuel waits for its opening receipt; close JSON
// waits for earlier fuel, including future retries and parked errors. Local saves never wait.
// Only sent/rejected/in_review predecessors release normal transport; final JSON bypasses this.
const UNSETTLED_FUEL = `(type='shift.close' AND EXISTS(SELECT 1 FROM outbox_event fuel
  WHERE fuel.type='fuel.load' AND fuel.shift_id=waiting.shift_id AND fuel.seq<waiting.seq
    AND fuel.local_status IN ('pending','sending','error')))`;
const UNSETTLED_OPENING = `(type='fuel.load' AND EXISTS(SELECT 1 FROM outbox_event opening
  WHERE opening.type='shift.open' AND opening.shift_id=waiting.shift_id
    AND opening.local_status IN ('pending','sending','error')))`;

/** Claim and timer share evidence/dependency/owner/final eligibility, before due/LIMIT/MIN. */
function eligibleRows({ fence, isFinal }: EvidenceSelection): SqlStatement {
  const owner = fence?.ownerKey ?? "";
  return {
    sql: `WITH RECURSIVE waiting AS (SELECT * FROM outbox_event WHERE local_status='pending'),
      ${DEPENDENCIES},blocked(id) AS (SELECT id FROM waiting WHERE ${isFinal ? "0" : `${UNVERIFIED_EVIDENCE} OR ${UNSETTLED_FUEL} OR ${UNSETTLED_OPENING}`}
        UNION SELECT edges.child FROM edges JOIN blocked ON edges.parent=blocked.id),
      eligible AS (SELECT * FROM waiting WHERE id NOT IN (SELECT id FROM blocked)
        AND ${fence === null ? "1" : CURRENT_FENCE})`,
    params: [
      ...(isFinal ? [] : [owner, owner, owner]),
      ...(fence === null ? [] : fenceParams(fence)),
    ],
  };
}

/** Eligibility and the generation CAS are evaluated by the SAME SQLite claim statement. */
export function eligibleClaim(input: {
  selection: EvidenceSelection;
  limit: number;
  now: string;
}): SqlStatement {
  const rows = eligibleRows(input.selection);
  return {
    sql: `${rows.sql} UPDATE outbox_event SET local_status='sending',updated_at=?
      WHERE id IN (SELECT id FROM eligible WHERE (retry_at IS NULL OR retry_at<=?) ORDER BY seq LIMIT ?)
      AND local_status='pending' RETURNING *`,
    params: [...(rows.params ?? []), input.now, input.now, input.limit],
  };
}

/** Future eligible retries remain visible; blocked work cannot cause a zero-delay pull loop. */
export function eligibleRetry(selection: EvidenceSelection): SqlStatement {
  const rows = eligibleRows(selection);
  return {
    sql: `${rows.sql} SELECT MIN(retry_at) AS retry_at FROM eligible WHERE retry_at IS NOT NULL`,
    params: rows.params,
  };
}
