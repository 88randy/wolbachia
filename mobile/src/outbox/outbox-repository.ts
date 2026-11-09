import type { SqlExecutor, SqlRow, SqlStatement, SqlValue } from "../db/sql.ts";
import { eligibleClaim, eligibleRetry } from "../attachments/evidence-eligibility.ts";
import type { EvidenceSelection } from "../attachments/evidence-eligibility.ts";
import { readInteger } from "../db/sql.ts";
import {
  readResult,
  readStatus,
  toOutboxEvent,
  toProblemItem,
  toTypeGroup,
} from "./outbox-event.ts";
import type {
  EventResult,
  FieldEventEnvelope,
  OutboxEvent,
  ProblemItem,
  TypeGroup,
} from "./outbox-event.ts";
import { applyOutboxAction, OUTBOX_STATUSES, PROBLEM_STATUSES } from "./outbox-status.ts";
import type { OutboxAction, OutboxStatus } from "./outbox-status.ts";

/** One status change. `undefined` keeps the stored value; `null` clears it. */
export interface OutboxTransition {
  readonly id: string;
  readonly action: OutboxAction;
  readonly lastError?: string | null;
  readonly result?: EventResult | null;
  /** Earliest resend time for evidence not stored by the server (rejection quota). */
  readonly retryAt?: string;
}

export type OutboxCounts = Readonly<Record<OutboxStatus, number>>;

/** The write failed (for example the phone's storage is full). The event was NOT saved. */
export class OutboxWriteError extends Error {
  constructor(cause: unknown) {
    super("The event could not be saved on the phone.", { cause });
    this.name = "OutboxWriteError";
  }
}

const COLUMNS_SQL = `INSERT INTO outbox_event (id, type, schema_version, device_time, payload, shift_id,
  gps, rules_version, catalog_version, manual_capture, voids_event_id, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const UPDATE_SQL = `UPDATE outbox_event SET local_status = ?, attempts = ?, last_error = ?,
  result_code = ?, result_params = ? , updated_at = ?, retry_at = ? WHERE id = ? AND local_status = ?`;

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function insertParams(event: FieldEventEnvelope, updatedAt: string): SqlValue[] {
  return [
    event.id,
    event.type,
    event.schema_version,
    event.device_time,
    JSON.stringify(event.payload),
    event.shift_id ?? null,
    event.gps === null || event.gps === undefined ? null : JSON.stringify(event.gps),
    event.rules_version,
    event.catalog_version,
    event.manual_capture ? 1 : 0,
    event.voids_event_id ?? null,
    updatedAt,
  ];
}

/** Reuse the existing outbox insertion for an atomic void-plus-replacement capture. */
export function eventInsertStatement(event: FieldEventEnvelope, updatedAt: string): SqlStatement {
  const params = insertParams(event, updatedAt);
  if (!event.shift_id || ["shift.open", "shift.close", "record.void"].includes(event.type))
    return { sql: COLUMNS_SQL, params };
  // The actual insertion arbitrates in-flight captures against local closure, including rejected closes.
  return {
    sql: COLUMNS_SQL.replace("VALUES (?,", "VALUES ((SELECT ? WHERE NOT EXISTS (SELECT 1 FROM outbox_event WHERE type='shift.close' AND shift_id=?)),"),
    params: [params[0] ?? null, event.shift_id, ...params.slice(1)],
  };
}

/**
 * The phone's outbox: every captured event waits here until the server answers.
 * Status changes go through `applyOutboxAction` only, so the rules live in one place.
 */
export class OutboxRepository {
  readonly #db: SqlExecutor;
  readonly #now: () => Date;

  constructor(db: SqlExecutor, now: () => Date) {
    this.#db = db;
    this.#now = now;
  }

  /** Saves a captured event as `pending`. Throws `OutboxWriteError` when it could not be stored. */
  async enqueue(event: FieldEventEnvelope, extra: readonly SqlStatement[] = []): Promise<void> {
    try {
      await this.#db.runAtomically([
        eventInsertStatement(event, this.#now().toISOString()),
        ...extra,
      ]);
    } catch (error) {
      throw new OutboxWriteError(error);
    }
  }

  /** Takes up to `limit` pending events, oldest first, and marks them `sending`. */
  async claimPending(
    limit: number,
    selection?: EvidenceSelection,
  ): Promise<readonly OutboxEvent[]> {
    if (selection !== undefined) return this.#claimEligible(limit, selection);
    const rows = await this.#db.query(
      `SELECT * FROM outbox_event WHERE local_status = 'pending'
       AND (retry_at IS NULL OR retry_at <= ?) ORDER BY seq LIMIT ?`,
      [this.#now().toISOString(), limit],
    );
    await this.settle(rows.map((row) => ({ id: idOf(row), action: "claim" as const })));
    return rows.map((row) => ({ ...toOutboxEvent(row), status: "sending" as const }));
  }

  async #claimEligible(
    limit: number,
    selection: EvidenceSelection,
  ): Promise<readonly OutboxEvent[]> {
    const state = applyOutboxAction({ status: "pending", attempts: 0 }, "claim");
    if (state?.status !== "sending") throw new Error("Invalid claim transition.");
    const statement = eligibleClaim({ selection, limit, now: this.#now().toISOString() });
    const rows = await this.#db.query(statement.sql, statement.params);
    return [...rows].sort((left, right) => Number(left.seq) - Number(right.seq)).map(toOutboxEvent);
  }

  /**
   * Applies status changes (and any extra statements, such as the new sync cursor) in ONE
   * transaction. Throws when a change is not allowed from the event's current status.
   */
  async settle(
    transitions: readonly OutboxTransition[],
    extra: readonly SqlStatement[] = [],
  ): Promise<void> {
    const current = await this.#loadRows(transitions.map((transition) => transition.id));
    const updates = transitions.map((transition) => this.#updateFor(transition, current));
    // SqlExecutor does not return affected rows. The engine serializes ALL sending transitions
    // (including startup/error recovery) in one loop; retryParked only touches error rows.
    // No concurrent writer can change a selected row between this read and its guarded UPDATE.
    await this.#db.runAtomically([...updates, ...extra]);
  }

  /** Earliest retry among claim-eligible events; future retries are included before taking MIN. */
  async nextRetryDelayMs(selection?: EvidenceSelection): Promise<number | null> {
    const statement =
      selection === undefined
        ? {
            sql: "SELECT MIN(retry_at) AS retry_at FROM outbox_event WHERE local_status = 'pending' AND retry_at IS NOT NULL",
          }
        : eligibleRetry(selection, this.#now().toISOString());
    const [row] = await this.#db.query(statement.sql, statement.params);
    const retryAt = row?.retry_at;
    return typeof retryAt === "string"
      ? Math.max(0, Date.parse(retryAt) - this.#now().getTime())
      : null;
  }

  /** Puts events a dead process left in `sending` back to `pending`. Returns how many. */
  async recoverInterrupted(): Promise<number> {
    const ids = await this.#idsWithStatus("sending");
    await this.settle(ids.map((id) => ({ id, action: "recover" as const })));
    return ids.length;
  }

  /** "Intentar ahora" on parked events: `error` goes back to `pending`. Returns how many. */
  async retryParked(): Promise<number> {
    const ids = await this.#idsWithStatus("error");
    await this.settle(ids.map((id) => ({ id, action: "retryNow" as const })));
    return ids.length;
  }

  /**
   * The status changes that review items pulled from the server imply for events the server
   * processed earlier (their answer was lost). Events that are unknown here or already final are
   * left out. It only reads; the caller settles the result with the rest of the batch.
   */
  async pulledReviewTransitions(
    reviews: readonly { eventId: string; kind: "rejected" | "in_review"; result: EventResult }[],
  ): Promise<readonly OutboxTransition[]> {
    const current = await this.#loadRows(reviews.map((review) => review.eventId));
    return reviews.flatMap((review): OutboxTransition[] => {
      const row = current.get(review.eventId);
      const action = review.kind === "rejected" ? "pulledRejected" : "pulledInReview";
      const allowed =
        row !== undefined &&
        applyOutboxAction({ status: readStatus(row), attempts: 0 }, action) !== null;
      return allowed ? [{ id: review.eventId, action, result: review.result }] : [];
    });
  }

  async countByStatus(): Promise<OutboxCounts> {
    const rows = await this.#db.query(
      "SELECT local_status, COUNT(*) AS total FROM outbox_event GROUP BY local_status",
    );
    const counts = Object.fromEntries(OUTBOX_STATUSES.map((status) => [status, 0])) as Record<
      OutboxStatus,
      number
    >;
    for (const row of rows) counts[readStatus(row)] = readInteger(row, "total");
    return counts;
  }

  /** Events a person has to look at, newest first. */
  async listProblems(limit: number): Promise<readonly ProblemItem[]> {
    const rows = await this.#db.query(
      `SELECT * FROM outbox_event WHERE local_status IN (${placeholders(PROBLEM_STATUSES.length)})
       ORDER BY seq DESC LIMIT ?`,
      [...PROBLEM_STATUSES, limit],
    );
    return rows.map(toProblemItem);
  }

  /** Events of the given statuses, grouped by type and status, most recent group first. */
  async groupByType(statuses: readonly OutboxStatus[]): Promise<readonly TypeGroup[]> {
    const rows = await this.#db.query(
      `SELECT type, local_status, COUNT(*) AS total, MIN(device_time) AS first_time,
         MAX(device_time) AS last_time FROM outbox_event
       WHERE local_status IN (${placeholders(statuses.length)})
       GROUP BY type, local_status ORDER BY MAX(seq) DESC`,
      [...statuses],
    );
    return rows.map(toTypeGroup);
  }

  async #idsWithStatus(status: OutboxStatus): Promise<string[]> {
    const rows = await this.#db.query("SELECT id FROM outbox_event WHERE local_status = ?", [
      status,
    ]);
    return rows.map(idOf);
  }

  async #loadRows(ids: readonly string[]): Promise<Map<string, SqlRow>> {
    if (ids.length === 0) return new Map();
    const rows = await this.#db.query(
      `SELECT * FROM outbox_event WHERE id IN (${placeholders(ids.length)})`,
      [...ids],
    );
    return new Map(rows.map((row) => [idOf(row), row]));
  }

  #updateFor(transition: OutboxTransition, current: ReadonlyMap<string, SqlRow>): SqlStatement {
    const row = current.get(transition.id);
    if (row === undefined) throw new Error(`Unknown outbox event ${transition.id}.`);
    const from = readStatus(row);
    const next = applyOutboxAction(
      { status: from, attempts: readInteger(row, "attempts") },
      transition.action,
    );
    if (next === null) {
      throw new Error(`Action ${transition.action} is not allowed from ${from}.`);
    }
    return { sql: UPDATE_SQL, params: this.#updateParams(transition, row, { from, next }) };
  }

  #updateParams(
    transition: OutboxTransition,
    row: SqlRow,
    change: { from: OutboxStatus; next: { status: OutboxStatus; attempts: number } },
  ): SqlValue[] {
    const { from, next } = change;
    const result = transition.result === undefined ? readResult(row) : transition.result;
    const lastError = transition.lastError === undefined ? lastErrorOf(row) : transition.lastError;
    return [
      next.status,
      next.attempts,
      lastError,
      result?.code ?? null,
      result === null ? null : JSON.stringify(result.params),
      this.#now().toISOString(),
      transition.retryAt ?? null,
      transition.id,
      from,
    ];
  }
}

function idOf(row: SqlRow): string {
  const { id } = row;
  if (typeof id !== "string") throw new Error("Column id is not text.");
  return id;
}

function lastErrorOf(row: SqlRow): string | null {
  const { last_error: lastError } = row;
  return typeof lastError === "string" ? lastError : null;
}
