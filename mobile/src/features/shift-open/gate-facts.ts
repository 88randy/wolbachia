import type { SqlExecutor, SqlRow, SqlStatement } from "../../db/sql.ts";
import { readOptionalText } from "../../db/sql.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import type { ChecklistCatalog, MapPreparation, OpenShiftDraft } from "./domain.ts";
import type { StoredShift } from "./store.ts";

export const SHIFT_CATALOG_KEY = "shift_open_catalog";
export const SHIFT_MAP_KEY = "shift_open_map";
const SOURCE = `FROM (SELECT 1) singleton
  LEFT JOIN shift_open_state s ON s.slot=1
  LEFT JOIN outbox_event e ON e.id=json_extract(s.draft,'$.openingEventId')
  LEFT JOIN kv c ON c.key='${SHIFT_CATALOG_KEY}'
  LEFT JOIN kv m ON m.key='${SHIFT_MAP_KEY}'`;
const FACTS = [
  ["s.draft", "shift_draft"],
  ["s.opening_event_id", "state_opening_id"],
  ["e.id", "opening_id"],
  ["e.local_status", "opening_status"],
  ["e.result_code", "opening_result_code"],
  ["c.value", "gate_catalog"],
  ["m.value", "gate_map"],
  ["(SELECT device_time FROM outbox_event closing WHERE closing.type='shift.close' AND closing.shift_id=e.shift_id ORDER BY closing.seq LIMIT 1)", "locally_closed_at"],
] as const;

export interface ShiftGateFacts extends StoredShift {
  readonly catalog: ChecklistCatalog | null;
  readonly map: MapPreparation | null;
  readonly guard: SqlStatement;
  readonly locallyClosedAt: string | null;
}
/** One durable read supplies both the existing gate's inputs and their original CAS guard. */
export async function readShiftGateFacts(db: SqlExecutor): Promise<ShiftGateFacts> {
  const columns = FACTS.map(([column, alias]) => `${column} AS ${alias}`).join(",");
  const [row] = await db.query(`SELECT e.*,${columns} ${SOURCE}`);
  if (!row) throw new Error("Shift gate snapshot unavailable.");
  return {
    draft: parseSaved(readOptionalText(row, "shift_draft")) as OpenShiftDraft | null,
    opening: readOptionalText(row, "opening_id") === null ? null : toOutboxEvent(row),
    catalog: parseSaved(readOptionalText(row, "gate_catalog")) as ChecklistCatalog | null,
    map: parseSaved(readOptionalText(row, "gate_map")) as MapPreparation | null,
    guard: originalGuard(row),
    locallyClosedAt: readOptionalText(row, "locally_closed_at"),
  };
}
function parseSaved(value: string | null): unknown {
  return value === null ? null : JSON.parse(value);
}
function originalGuard(row: SqlRow): SqlStatement {
  return {
    sql: `SELECT 1 ${SOURCE} WHERE ${FACTS.map(([column]) => `${column} IS ?`).join(" AND ")}`,
    params: FACTS.map(([, alias]) => readOptionalText(row, alias)),
  };
}
