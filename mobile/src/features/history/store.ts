import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { SqlExecutor, SqlRow } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import { readHistoryEntry } from "../ovitrap-lifecycle/history-contract.ts";
import { CURRENT_CAPTURE_CONTEXT } from "../ovitrap-lifecycle/context-sql.ts";
import { localHistory, serverHistory, text } from "./domain.ts";
import type { HistoryView, HistoryEntry } from "./domain.ts";
import type { Draft } from "../ovitrap-check/types.ts";
import type { Schemas } from "@wolbachia/api-client";
import { permitsLocal, permitsSubjects } from "./scope.ts";

function codes(payload: object, index: ReadonlyMap<string, string>): readonly string[] {
  const direct = ["code", "bag_code", "motorcycle_code", "point_code"].map((key) =>
    text(payload, key),
  );
  const related = ["ovitrap_id", "sampling_point_id", "point_id", "lot_id", "bag_id"]
    .map((key) => text(payload, key))
    .map((id) => (id ? (index.get(id) ?? null) : null));
  return [...new Set([...direct, ...related].filter((code): code is string => code !== null))];
}
const HISTORY_SNAPSHOT = `SELECT
    EXISTS(SELECT 1 FROM (${CURRENT_CAPTURE_CONTEXT}) context WHERE json_extract(context.value,'$.ownerKey')=?
      AND json_extract(context.value,'$.sessionId')=?
      AND EXISTS(SELECT 1 FROM kv WHERE key='history_projection_ready' AND value='true')) AS available,
    COALESCE((SELECT json_group_array(json(body)) FROM lifecycle_courier_projection WHERE kind LIKE 'history.%'),'[]') AS history,
    COALESCE((SELECT value FROM (${CURRENT_CAPTURE_CONTEXT})),'{}') AS context,
    COALESCE((SELECT json_group_array(json(body)) FROM lifecycle_courier_projection WHERE kind IN ('ovitrap','sampling_point','quadrant','block')),'[]') AS resources,
    COALESCE((SELECT json_group_array(json_object('seq',seq,'id',id,'type',type,'schema_version',schema_version,
      'device_time',device_time,'payload',payload,'shift_id',shift_id,'gps',gps,'rules_version',rules_version,
      'catalog_version',catalog_version,'manual_capture',manual_capture,'voids_event_id',voids_event_id,
      'local_status',local_status,'attempts',attempts,'last_error',last_error,'result_code',result_code,'result_params',result_params,
      'capture',(SELECT draft FROM ovitrap_capture WHERE event_id=outbox_event.id)))
      FROM outbox_event),'[]') AS events`;
function codeIndex(snapshot: SqlRow): ReadonlyMap<string, string> {
  const resources = JSON.parse(readText(snapshot, "resources")) as object[];
  const index = new Map<string, string>();
  for (const row of resources) {
    const id = text(row, "id"),
      code = text(row, "code");
    if (id && code) index.set(id, code);
  }
  for (const row of resources) {
    const id = text(row, "id"),
      pointId = text(row, "sampling_point_id");
    const code = pointId ? index.get(pointId) : null;
    if (id && code) index.set(id, code);
  }
  return index;
}
function localEntries(snapshot: SqlRow, author: string): readonly HistoryEntry[] {
  const index = codeIndex(snapshot);
  const raw = JSON.parse(readText(snapshot, "events")) as Parameters<typeof toOutboxEvent>[0][];
  const scope = historyScope(snapshot);
  return raw
    .filter((row) => permitsLocal(toOutboxEvent(row), scope))
    .map((row) => {
      const event = toOutboxEvent(row);
      return {
        ...localHistory(event, codes(event.envelope.payload, index), author),
        observation: archivedObservation(row),
      };
    });
}
/** Captured catalog labels describe the original finding, never a renamed current catalog. */
function archivedObservation(row: SqlRow): HistoryEntry["observation"] {
  if (typeof row.capture !== "string") return null;
  const draft = JSON.parse(row.capture) as Draft;
  const finding = draft.catalog?.findings.find((item) => item.code === draft.finding);
  return finding ? { es: finding.label_es, en: finding.label_en || finding.label_es } : null;
}
function remoteEntries(snapshot: SqlRow, local: readonly HistoryEntry[]): readonly HistoryEntry[] {
  const originals = new Map(local.map((entry) => [entry.id, entry]));
  const scope = historyScope(snapshot);
  return scope.history
    .filter((row) => permitsSubjects(scope.grants, row.subjects))
    .map((row) =>
      serverHistory(
        row,
        originals.get(text(row, "source_event_id") ?? text(row, "proposal_event_id") ?? ""),
      ),
    );
}
function historyScope(snapshot: SqlRow) {
  const stored = JSON.parse(readText(snapshot, "context")) as {
    context: Schemas["CaptureContext"];
  };
  const raw = JSON.parse(readText(snapshot, "events")) as Parameters<typeof toOutboxEvent>[0][];
  const history = (JSON.parse(readText(snapshot, "history")) as unknown[])
    .filter(
      (row) => row !== null && typeof row === "object" && Reflect.get(row, "_available") !== false,
    )
    .map(readHistoryEntry);
  return {
    grants: stored.context.grants,
    history,
    resources: JSON.parse(readText(snapshot, "resources")) as object[],
    events: raw.map(toOutboxEvent),
  };
}
/** A single SQLite snapshot, under the existing projection writer, prevents mixed-scope joins. */
export async function readHistory(
  db: SqlExecutor,
  identity: EvidenceIdentity,
  author: string,
): Promise<HistoryView> {
  const [snapshot] = await db.query(HISTORY_SNAPSHOT, [
    ownerKey(identity.owner),
    identity.sessionId,
  ]);
  // A retained outbox is not a current display grant when scope/readiness is unavailable.
  if (snapshot?.available !== 1) return { available: false, entries: [] };
  if (historyScope(snapshot).grants.length === 0) return { available: false, entries: [] };
  const local = localEntries(snapshot, author);
  return { available: true, entries: [...local, ...remoteEntries(snapshot, local)] };
}
