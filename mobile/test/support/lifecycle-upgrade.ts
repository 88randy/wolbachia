import type { SqlExecutor } from "../../src/db/sql.ts";
import { OutboxRepository } from "../../src/outbox/outbox-repository.ts";
import { makeEnvelope, FIXED_NOW } from "./factories.ts";

const OLD_ID = "11111111-1111-4111-8111-111111111111";
const NEW_ID = "22222222-2222-4222-8222-222222222222";
const POINT = { id: "33333333-3333-4333-8333-333333333333", code: "fixed-point" };
const PHOTO = { id: "44444444-4444-4444-8444-444444444444", fileRef: "retained-private-fixture" };
const CAPTURED_CONTEXT = {
  deviceTime: FIXED_NOW.toISOString(),
  manualCapture: true,
  assignment: { version: "captured-assignment", points: [POINT] },
  catalog: { version: "captured-catalog" },
  rules: { version: "captured-rules" },
};

async function appendCapture(db: SqlExecutor, eventId: string, kind: "replace" | "remove") {
  const ovitrapId = kind === "replace" ? OLD_ID : NEW_ID;
  const draft = JSON.stringify({
    ...CAPTURED_CONTEXT,
    eventId,
    kind,
    ovitrapId,
    point: POINT,
    replacementId: kind === "replace" ? NEW_ID : null,
    evidence: [PHOTO],
  });
  await db.runAtomically([
    {
      sql: "INSERT INTO lifecycle_draft(slot,draft) VALUES(1,?) ON CONFLICT(slot) DO UPDATE SET draft=excluded.draft",
      params: [draft],
    },
    {
      sql: "INSERT INTO lifecycle_capture(event_id,ovitrap_id,point_id,kind,draft) VALUES(?,?,?,?,?)",
      params: [eventId, ovitrapId, POINT.id, kind, draft],
    },
    {
      sql: "INSERT INTO lifecycle_evidence(event_id,evidence_id,file_ref) VALUES(?,?,?)",
      params: [eventId, PHOTO.id, PHOTO.fileRef],
    },
    { sql: "INSERT INTO lifecycle_archive(event_id,draft) VALUES(?,?)", params: [eventId, draft] },
  ]);
}

function upgradeEvents() {
  const replacement = makeEnvelope({
    type: "ovitrap.replace",
    payload: { ovitrap_id: OLD_ID, replacement_id: NEW_ID, evidence_ids: [PHOTO.id] },
  });
  const removal = makeEnvelope({
    type: "ovitrap.remove",
    payload: { ovitrap_id: NEW_ID, is_recovered: false, evidence_ids: [PHOTO.id] },
  });
  const correction = makeEnvelope({
    type: "record.void",
    voids_event_id: removal.id,
    payload: { reason: "retained correction reason" },
  });
  return { replacement, removal, correction };
}
async function appendCorrection(db: SqlExecutor, targetId: string, correctionId: string) {
  await db.runAtomically([
    {
      sql: "INSERT INTO lifecycle_void(event_id,target_event_id,reason_code,reason) VALUES(?,?,'other',?)",
      params: [correctionId, targetId, "retained correction reason"],
    },
    { sql: "UPDATE outbox_event SET local_status='sent',result_code='accepted'" },
    ...[OLD_ID, NEW_ID].map((id, index) => ({
      sql: "INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body) VALUES('ovitrap',?,'retained-version',?,?)",
      params: [id, index === 0 ? 17 : 23, JSON.stringify({ id, sampling_point_id: POINT.id })],
    })),
  ]);
}
/** Past persisted facts only: no old runtime handlers, inferred owner or file adoption. */
export async function seedLifecycleUpgrade(db: SqlExecutor) {
  const outbox = new OutboxRepository(db, () => FIXED_NOW);
  const { replacement, removal, correction } = upgradeEvents();
  for (const envelope of [replacement, removal, correction]) await outbox.enqueue(envelope);
  await db.runAtomically([
    {
      sql: "INSERT INTO lifecycle_identity(id,event_id) VALUES(?,?)",
      params: [NEW_ID, replacement.id],
    },
  ]);
  await appendCapture(db, replacement.id, "replace");
  await appendCapture(db, removal.id, "remove");
  await appendCorrection(db, removal.id, correction.id);
  return [
    { event_id: replacement.id, ovitrap_id: OLD_ID, projection_sequence: 17, is_reconciled: 0 },
    { event_id: replacement.id, ovitrap_id: NEW_ID, projection_sequence: 23, is_reconciled: 0 },
    { event_id: removal.id, ovitrap_id: NEW_ID, projection_sequence: 23, is_reconciled: 0 },
    { event_id: correction.id, ovitrap_id: NEW_ID, projection_sequence: 23, is_reconciled: 0 },
  ];
}

export async function retainedLifecycleFacts(db: SqlExecutor) {
  const result = [];
  for (const table of [
    "outbox_event",
    "kv",
    "lifecycle_draft",
    "lifecycle_archive",
    "lifecycle_capture",
    "lifecycle_evidence",
    "lifecycle_identity",
    "lifecycle_void",
    "lifecycle_courier_projection",
  ])
    result.push(await db.query(`SELECT * FROM ${table} ORDER BY rowid`));
  return result;
}
