import { readText } from "../../db/sql.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { captureWeek } from "../ovitrap-check/capture-week.ts";
import type { Draft } from "../ovitrap-check/types.ts";
import type { LifecycleDraft } from "./types.ts";
const WEEK_MS = 7 * 86_400_000;
/** Only locally known unvoided check history counts, at the fixed point across physical lineage. */
export async function relocationSuggestion(db: SqlExecutor, draft: LifecycleDraft) {
  if (draft.kind !== "relocate") return null;
  if (draft.schemaVersion === 2)
    return { state: "unavailable" as const, reason: "advisory_not_loaded" as const };
  const threshold = draft.rules?.closedHouseWeeks;
  if (!threshold || !Number.isInteger(threshold) || threshold < 1 || threshold > 8) return null;
  const rows = await db.query(
    `SELECT c.draft FROM ovitrap_capture c JOIN outbox_event e ON e.id=c.event_id
    WHERE c.mode='check' AND json_extract(c.draft,'$.point.id')=? AND json_extract(c.draft,'$.finding')='closed-house'
    AND e.device_time<=? AND e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS(SELECT 1 FROM ovitrap_lineage l JOIN outbox_event ve ON ve.id=l.void_event_id WHERE l.target_event_id=c.event_id AND ve.local_status NOT IN ('rejected','in_review'))`,
    [draft.point.id, draft.deviceTime],
  );
  const weeks = new Set(
    rows.map((row) => captureWeek(JSON.parse(readText(row, "draft")) as Draft)),
  );
  const expected = Array.from({ length: threshold }, (_, index) =>
    captureWeek({
      deviceTime: new Date(Date.parse(draft.deviceTime) - index * WEEK_MS).toISOString(),
      assignment: draft.assignment,
    }),
  );
  return expected.every((week) => week && weeks.has(week)) ? { closedHouseWeeks: threshold } : null;
}
