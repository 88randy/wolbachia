import type { SqlExecutor, SqlStatement } from "../db/sql.ts";
import { readInteger, readText } from "../db/sql.ts";
import { EvidenceError, ownerKey } from "./types.ts";
import type { EvidenceFence, EvidenceOwner, OwnedEvidence, StoredEvidence } from "./types.ts";

export const CURRENT_FENCE = `EXISTS(SELECT 1 FROM attachment_context WHERE slot=1
  AND owner_key=? AND session_id=? AND generation=? AND is_active=1)`;
export const fenceParams = (fence: EvidenceFence) => [
  fence.ownerKey,
  fence.sessionId,
  fence.generation,
];
const FILE_PARENT =
  "attachment_file f JOIN attachment_event b ON b.evidence_id=f.id JOIN outbox_event e ON e.id=b.event_id";
const PARENT_RECEIPT =
  "e.local_status IN ('sent','in_review') AND e.result_code IS NOT NULL AND e.result_params IS NOT NULL";
const NEEDS_TRANSPORT = `(f.state<>'verified' OR f.is_bound=0) AND (f.state<>'verified' OR (${PARENT_RECEIPT}))`;

/** All progress is CAS guarded; captured identity and bytes never change. */
export class AttachmentStore {
  readonly db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.db = db;
  }

  async bindSession(
    input: { owner: EvidenceOwner; sessionId: string } | null,
    isLogin = false,
  ): Promise<EvidenceFence | null> {
    const key = input === null ? null : ownerKey(input.owner);
    const session = input?.sessionId ?? null;
    const isActive = input === null ? 0 : 1;
    const [row] = await this.db.query(
      `UPDATE attachment_context SET owner_key=?,session_id=?,is_active=?,
      generation=generation+CASE WHEN owner_key IS ? AND session_id IS ? AND is_active=? THEN 0 ELSE 1 END
      WHERE slot=1 AND (?=0 OR NOT EXISTS(SELECT 1 FROM attachment_file WHERE owner_key IS NOT ?)) RETURNING generation`,
      [key, session, isActive, key, session, isActive, isLogin || input !== null ? 1 : 0, key],
    );
    if (!row) throw new EvidenceError("owner_conflict");
    if (input === null) return null;
    return {
      ownerKey: ownerKey(input.owner),
      sessionId: input.sessionId,
      generation: readInteger(row, "generation"),
    };
  }

  async reserve(input: { id: string; draftId: string; fence: EvidenceFence }): Promise<void> {
    const { id, draftId, fence } = input;
    const rows = await this.db.query(
      `INSERT INTO attachment_file(id,owner_key,draft_id)
      SELECT ?,?,? WHERE ${CURRENT_FENCE} AND NOT EXISTS(SELECT 1 FROM ovitrap_evidence WHERE lower(evidence_id)=?)
      RETURNING id`,
      [id, fence.ownerKey, draftId, ...fenceParams(fence), id],
    );
    if (!rows.length) throw new EvidenceError("stale_context");
  }

  async saveOwned(file: OwnedEvidence, fence: EvidenceFence): Promise<void> {
    const rows = await this.db.query(
      `UPDATE attachment_file SET metadata=?,state='ready'
      WHERE id=? AND owner_key=? AND metadata IS NULL AND ${CURRENT_FENCE} RETURNING id`,
      [JSON.stringify(file), file.id, fence.ownerKey, ...fenceParams(fence)],
    );
    if (!rows.length) throw new EvidenceError("stale_context");
  }

  bindingStatements(input: {
    eventId: string;
    evidenceIds: readonly string[];
    fence: EvidenceFence;
  }): readonly SqlStatement[] {
    return input.evidenceIds.map((id) => ({
      sql: `INSERT INTO attachment_event(evidence_id,event_id) VALUES((SELECT id FROM attachment_file
        WHERE id=? AND draft_id=? AND metadata IS NOT NULL AND owner_key=? AND ${CURRENT_FENCE}),?)`,
      params: [id, input.eventId, input.fence.ownerKey, ...fenceParams(input.fence), input.eventId],
    }));
  }

  async next(fence: EvidenceFence, now: string): Promise<StoredEvidence | null> {
    const [row] = await this.db.query(
      `SELECT f.*,CASE WHEN ${PARENT_RECEIPT} THEN e.id ELSE NULL END AS parent_id
      FROM ${FILE_PARENT} WHERE f.owner_key=? AND f.metadata IS NOT NULL AND ${NEEDS_TRANSPORT}
      AND (f.retry_at IS NULL OR f.retry_at<=?) AND ${CURRENT_FENCE} AND e.local_status<>'rejected'
      ORDER BY f.attempts,f.id LIMIT 1`,
      [fence.ownerKey, now, ...fenceParams(fence)],
    );
    return row
      ? {
          file: JSON.parse(readText(row, "metadata")) as OwnedEvidence,
          state: readText(row, "state") as StoredEvidence["state"],
          attempts: readInteger(row, "attempts"),
          parentEventId: typeof row.parent_id === "string" ? row.parent_id : null,
        }
      : null;
  }

  async saveProgress(input: {
    id: string;
    fence: EvidenceFence;
    state: StoredEvidence["state"];
    verifiedAt?: string;
    isBound?: boolean;
    attemptVersion: number;
  }): Promise<boolean> {
    const rows = await this.db.query(
      `UPDATE attachment_file SET state=?,verified_at=?,is_bound=MAX(is_bound,?),last_error=NULL,retry_at=NULL
      WHERE id=? AND owner_key=? AND ${CURRENT_FENCE} AND attempt_version=? RETURNING id`,
      [
        input.state,
        input.verifiedAt ?? null,
        input.isBound === true ? 1 : 0,
        input.id,
        input.fence.ownerKey,
        ...fenceParams(input.fence),
        input.attemptVersion,
      ],
    );
    return rows.length === 1;
  }

  async saveFailure(input: {
    id: string;
    fence: EvidenceFence;
    code: string;
    retryAt: string;
    attemptVersion?: number;
  }): Promise<void> {
    const version = input.attemptVersion ?? null;
    const guard = version === null ? "metadata IS NULL" : "attempt_version=?";
    await this.db.query(
      `UPDATE attachment_file SET last_error=?,retry_at=?,attempts=attempts+1,attempt_version=attempt_version+?
      WHERE id=? AND owner_key=? AND ${CURRENT_FENCE} AND ${guard}`,
      [
        input.code,
        input.retryAt,
        version === null ? 0 : 1,
        input.id,
        input.fence.ownerKey,
        ...fenceParams(input.fence),
        ...(version === null ? [] : [version]),
      ],
    );
  }

  async beginAttempt(id: string, fence: EvidenceFence): Promise<number | null> {
    const [row] = await this.db.query(
      `UPDATE attachment_file SET attempt_version=attempt_version+1
      WHERE id=? AND owner_key=? AND ${CURRENT_FENCE} RETURNING attempt_version`,
      [id, fence.ownerKey, ...fenceParams(fence)],
    );
    return row ? readInteger(row, "attempt_version") : null;
  }

  async requireAttempt(input: {
    id: string;
    fence: EvidenceFence;
    attemptVersion: number | undefined;
  }): Promise<void> {
    if (input.attemptVersion === undefined) throw new EvidenceError("stale_attempt");
    const rows = await this.db.query(
      `SELECT 1 FROM attachment_file WHERE id=? AND owner_key=?
      AND attempt_version=? AND ${CURRENT_FENCE}`,
      [input.id, input.fence.ownerKey, input.attemptVersion, ...fenceParams(input.fence)],
    );
    if (!rows.length) throw new EvidenceError("stale_attempt");
  }

  async nextRetryDelayMs(now: number): Promise<number | null> {
    const [row] = await this.db.query(
      `SELECT MIN(COALESCE(f.retry_at,?)) AS due FROM ${FILE_PARENT} JOIN attachment_context c
      ON c.owner_key=f.owner_key AND c.is_active=1 WHERE ${NEEDS_TRANSPORT} AND f.metadata IS NOT NULL
      AND e.local_status<>'rejected'`,
      [new Date(now).toISOString()],
    );
    return typeof row?.due === "string" ? Math.max(0, Date.parse(row.due) - now) : null;
  }

  async isCurrent(fence: EvidenceFence): Promise<boolean> {
    const rows = await this.db.query(`SELECT 1 WHERE ${CURRENT_FENCE}`, fenceParams(fence));
    return rows.length === 1;
  }

  async recoverInterrupted(): Promise<void> {
    const rows = await this.db.query("SELECT generation FROM attachment_context WHERE slot=1");
    if (!rows.length) throw new EvidenceError("file_journal");
    // No volatile sending flag: authorized/received replay via renew with the original UUID.
  }

  async pendingSummary(): Promise<{ pending: number; hasError: boolean }> {
    const [row] = await this.db
      .query(`SELECT COUNT(*) AS pending,COALESCE(MAX(f.last_error IS NOT NULL),0) AS has_error
      FROM ${FILE_PARENT} JOIN attachment_context c ON c.owner_key=f.owner_key AND c.is_active=1
      WHERE e.local_status<>'rejected' AND (f.state<>'verified' OR f.is_bound=0)`);
    if (!row) throw new EvidenceError("file_journal");
    return { pending: readInteger(row, "pending"), hasError: readInteger(row, "has_error") === 1 };
  }

  async retryNow(fence: EvidenceFence): Promise<void> {
    await this.db.query(
      `UPDATE attachment_file SET retry_at=NULL WHERE owner_key=? AND (state<>'verified' OR is_bound=0)
      AND ${CURRENT_FENCE}`,
      [fence.ownerKey, ...fenceParams(fence)],
    );
  }
}
