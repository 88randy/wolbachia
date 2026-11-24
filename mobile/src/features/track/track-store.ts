import type { SqlExecutor, SqlRow, SqlStatement } from "../../db/sql.ts";
import { readInteger, readOptionalText, readText } from "../../db/sql.ts";
import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import { eventInsertStatement } from "../../outbox/outbox-repository.ts";
import { compactSegmentPayload } from "./schema.ts";
import { simplifyTrack } from "./simplify-track.ts";
import type { TrackFix } from "./simplify-track.ts";
import type { TrackRules } from "./track-rules.ts";

/** Server limits of `track.segment` schema 1 (docs/sync.md "Courier track"). */
export const MAX_SEGMENT_POSITIONS = 250;
const MAX_SPAN_MS = 86_400_000;
const MAX_ACCURACY_M = 5000;
/** Owner decision: the phone keeps its own track for 30 days. */
export const LOCAL_RETENTION_MS = 30 * 86_400_000;

/** kv key prefix: the owner that first tracked a shift; another owner never records into it. */
const SHIFT_OWNER_KEY = "track_shift_owner:";
const OPEN_SHIFT_SQL = `SELECT shift_id FROM outbox_event opening WHERE type='shift.open'
  AND local_status!='rejected' AND shift_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM outbox_event
  closing WHERE closing.type='shift.close' AND closing.shift_id=opening.shift_id)
  AND COALESCE((SELECT value FROM kv WHERE key='${SHIFT_OWNER_KEY}'||opening.shift_id), ?)=?
  ORDER BY seq DESC LIMIT 1`;
const POINT_COLUMNS = "recorded_at, lat, lng, accuracy_m";

export interface CutInput {
  readonly owner: string;
  readonly rules: Pick<TrackRules, "simplifyToleranceM" | "stillHeartbeatSeconds">;
  readonly uuid: () => string;
  readonly now: () => number;
  readonly versions: { readonly rules: string; readonly catalog: string };
}

function toFix(row: SqlRow): TrackFix {
  const number = (column: string) => {
    const value = row[column];
    if (typeof value !== "number") throw new Error(`Column ${column} is not a number.`);
    return value;
  };
  return {
    at: readInteger(row, "recorded_at"),
    lat: number("lat"),
    lng: number("lng"),
    accuracyM: number("accuracy_m"),
  };
}

/** Splits into server-sized chunks: at most 250 positions and one day of offsets each. */
function chunks(points: readonly TrackFix[]): TrackFix[][] {
  const result: TrackFix[][] = [];
  for (const point of points) {
    const current = result[result.length - 1];
    const first = current?.[0];
    if (
      current === undefined ||
      first === undefined ||
      current.length >= MAX_SEGMENT_POSITIONS ||
      point.at - first.at > MAX_SPAN_MS
    )
      result.push([point]);
    else current.push(point);
  }
  return result;
}

const coordinate = (value: number) => Number(value.toFixed(6));

function positionsOf(points: readonly TrackFix[], startedAt: number): number[][] {
  return points.map((point) => [
    Math.floor((point.at - startedAt) / 1000),
    coordinate(point.lat),
    coordinate(point.lng),
    Math.min(MAX_ACCURACY_M, Math.max(0, Math.round(point.accuracyM))),
  ]);
}

function segmentEvent(input: {
  readonly id: string;
  readonly shiftId: string;
  readonly points: readonly TrackFix[];
  readonly versions: CutInput["versions"];
}): FieldEventEnvelope {
  const { points } = input;
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) throw new Error("Empty track segment.");
  return {
    id: input.id,
    type: "track.segment",
    schema_version: 1,
    device_time: new Date(last.at).toISOString(),
    shift_id: input.shiftId,
    gps: null,
    manual_capture: false,
    voids_event_id: null,
    rules_version: input.versions.rules,
    catalog_version: input.versions.catalog,
    payload: {
      started_at: new Date(first.at).toISOString(),
      positions: positionsOf(points, first.at),
    },
  };
}

/** Per segment: insert its event and stamp the unsent points up to its last position. */
function segmentStatements(
  input: CutInput,
  shiftId: string,
  segments: readonly (readonly TrackFix[])[],
): SqlStatement[] {
  const updatedAt = new Date(input.now()).toISOString();
  return segments.flatMap((points) => {
    const event = segmentEvent({ id: input.uuid(), shiftId, points, versions: input.versions });
    return [
      // A late segment is valid while its last position is not after the local close.
      eventInsertStatement(event, updatedAt, { isLateCapture: true }),
      {
        sql: `UPDATE track_point SET segment_event_id=? WHERE owner_user_id=? AND shift_id=?
          AND segment_event_id IS NULL AND recorded_at<=?`,
        params: [event.id, input.owner, shiftId, points[points.length - 1]?.at ?? 0],
      },
    ];
  });
}

/** Local `track_point` rows and their cut into `track.segment` outbox events. */
export class TrackStore {
  readonly #db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.#db = db;
  }

  /**
   * The newest open local shift (opening not rejected, no local close) that `owner` may track.
   * The first owner to track a shift claims it, so points never carry another owner's shift.
   */
  async openShiftId(owner: string): Promise<string | null> {
    const [row] = await this.#db.query(OPEN_SHIFT_SQL, [owner, owner]);
    const shiftId = row === undefined ? null : readOptionalText(row, "shift_id");
    if (shiftId !== null)
      await this.#db.runAtomically([
        {
          sql: "INSERT OR IGNORE INTO kv(key, value) VALUES (?, ?)",
          params: [SHIFT_OWNER_KEY + shiftId, owner],
        },
      ]);
    return shiftId;
  }

  /** The newest shift `owner` claimed, open or closed (a late batch may still belong to it). */
  async lastShiftOf(owner: string): Promise<string | null> {
    const [row] = await this.#db.query(
      `SELECT o.shift_id FROM outbox_event o JOIN kv ON kv.key='${SHIFT_OWNER_KEY}'||o.shift_id
       AND kv.value=? WHERE o.type='shift.open' ORDER BY o.seq DESC LIMIT 1`,
      [owner],
    );
    return row === undefined ? null : readText(row, "shift_id");
  }

  async lastKept(owner: string, shiftId: string): Promise<TrackFix | null> {
    const [row] = await this.#db.query(
      `SELECT ${POINT_COLUMNS} FROM track_point WHERE owner_user_id=? AND shift_id=?
       ORDER BY recorded_at DESC, id DESC LIMIT 1`,
      [owner, shiftId],
    );
    return row === undefined ? null : toFix(row);
  }

  async append(owner: string, shiftId: string, fixes: readonly TrackFix[]): Promise<void> {
    if (fixes.length === 0) return;
    await this.#db.runAtomically(
      fixes.map((fix) => ({
        sql: `INSERT INTO track_point (owner_user_id, shift_id, ${POINT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [owner, shiftId, fix.at, fix.lat, fix.lng, fix.accuracyM],
      })),
    );
  }

  async listForShift(owner: string, shiftId: string): Promise<readonly TrackFix[]> {
    const rows = await this.#db.query(
      `SELECT ${POINT_COLUMNS} FROM track_point WHERE owner_user_id=? AND shift_id=?
       ORDER BY recorded_at, id`,
      [owner, shiftId],
    );
    return rows.map(toFix);
  }

  /**
   * Turns every unsent point of `owner` into `track.segment` events. Per shift, ONE transaction
   * inserts the events and stamps `segment_event_id` on the points they cover (the simplified-away
   * ones too), so a point is either unsent or carried by exactly one event. Points after a local
   * close are out-of-shift data: they are deleted, never sent. Callers serialize cuts.
   */
  async cut(input: CutInput): Promise<number> {
    const shifts = await this.#db.query(
      "SELECT DISTINCT shift_id FROM track_point WHERE owner_user_id=? AND segment_event_id IS NULL",
      [input.owner],
    );
    let total = 0;
    for (const row of shifts) total += await this.#cutShift(input, readText(row, "shift_id"));
    return total;
  }

  /** Device time of the local close of shiftId; Infinity while it is open. */
  async closedAt(shiftId: string): Promise<number> {
    const [closing] = await this.#db.query(
      "SELECT device_time FROM outbox_event WHERE type='shift.close' AND shift_id=? ORDER BY seq LIMIT 1",
      [shiftId],
    );
    return closing === undefined ? Infinity : Date.parse(readText(closing, "device_time"));
  }

  async #cutShift(input: CutInput, shiftId: string): Promise<number> {
    const closedAt = await this.closedAt(shiftId);
    const rows = await this.#db.query(
      `SELECT ${POINT_COLUMNS} FROM track_point WHERE owner_user_id=? AND shift_id=?
       AND segment_event_id IS NULL ORDER BY recorded_at, id`,
      [input.owner, shiftId],
    );
    const inside = rows.map(toFix).filter((point) => point.at <= closedAt);
    const segments = chunks(
      simplifyTrack(
        inside,
        input.rules.simplifyToleranceM,
        input.rules.stillHeartbeatSeconds * 1000,
      ),
    );
    const statements = segmentStatements(input, shiftId, segments);
    if (Number.isFinite(closedAt))
      statements.push({
        sql: `DELETE FROM track_point WHERE owner_user_id=? AND shift_id=?
          AND segment_event_id IS NULL AND recorded_at>?`,
        params: [input.owner, shiftId, closedAt],
      });
    if (statements.length > 0) await this.#db.runAtomically(statements);
    return segments.length;
  }

  /**
   * After 30 days, drops points whose event has a final answer and compacts those events'
   * positions (the server keeps the track). Unsent points and pending events stay whole.
   */
  async prune(nowMs: number): Promise<void> {
    const final = "local_status IN ('sent','in_review','rejected')";
    const cutoff = nowMs - LOCAL_RETENTION_MS;
    await this.#db.runAtomically([
      {
        sql: `DELETE FROM track_point WHERE recorded_at<? AND segment_event_id IN
          (SELECT id FROM outbox_event WHERE ${final})`,
        params: [cutoff],
      },
      {
        sql: `UPDATE outbox_event SET payload=${compactSegmentPayload("payload")}
          WHERE type='track.segment' AND ${final} AND julianday(device_time)<julianday(?)
          AND json_extract(payload,'$.compacted') IS NULL`,
        params: [new Date(cutoff).toISOString()],
      },
    ]);
  }
}
