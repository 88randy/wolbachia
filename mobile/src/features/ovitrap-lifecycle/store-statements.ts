import type { SqlStatement } from "../../db/sql.ts";
import type { LifecycleDraft } from "./types.ts";
export function lifecycleStatements(draft: LifecycleDraft): readonly SqlStatement[] {
  return [
    {
      sql: "INSERT INTO lifecycle_capture(event_id,ovitrap_id,point_id,kind,draft) VALUES(?,?,?,?,?)",
      params: [draft.eventId, draft.ovitrapId, draft.point.id, draft.kind, JSON.stringify(draft)],
    },
    ...draft.evidence.map((item) => ({
      sql: "INSERT INTO lifecycle_evidence(event_id,evidence_id,file_ref) VALUES(?,?,?)",
      params: [draft.eventId, item.id, item.fileRef],
    })),
    {
      sql: "UPDATE lifecycle_draft SET draft=?,event_id=? WHERE slot=1",
      params: [JSON.stringify(draft), draft.eventId],
    },
  ];
}
