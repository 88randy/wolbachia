import assert from "node:assert/strict";
import type { SqlExecutor } from "../../src/db/sql.ts";
import type { Draft } from "../../src/features/ovitrap-check/types.ts";
import type { FieldEventEnvelope } from "../../src/outbox/outbox-event.ts";
import { OutboxRepository } from "../../src/outbox/outbox-repository.ts";
import { FIXED_NOW } from "./factories.ts";

/** Seed facts on a real released prefix, never a current writer or an authority bypass. */
export async function retainedCapture(
  db: SqlExecutor,
  input: {
    draft: Draft;
    envelope: FieldEventEnvelope;
    epiWeek: string;
  },
) {
  const version = Number((await db.query("PRAGMA user_version"))[0]?.user_version);
  assert.ok(version >= 1 && version <= 11, "Retained fixture requires an actual released prefix");
  const { draft, envelope, epiWeek } = input;
  await new OutboxRepository(db, () => FIXED_NOW).enqueue(envelope, [
    { sql: "INSERT INTO ovitrap_draft(slot,draft) VALUES(1,?)", params: [JSON.stringify(draft)] },
    {
      sql: "INSERT INTO ovitrap_capture(event_id,ovitrap_id,mode,epi_week,draft) VALUES(?,?,?,?,?)",
      params: [draft.eventId, draft.ovitrapId, draft.mode, epiWeek, JSON.stringify(draft)],
    },
    ...draft.evidence.map((evidence) => ({
      sql: "INSERT INTO ovitrap_evidence(event_id,evidence_id,file_ref) VALUES(?,?,?)",
      params: [draft.eventId, evidence.id, evidence.fileRef],
    })),
    { sql: "UPDATE ovitrap_draft SET event_id=? WHERE slot=1", params: [draft.eventId] },
  ]);
  return envelope;
}
