import type { SqlStatement } from "../../db/sql.ts";
import { CourierContractError, readNonempty, readRecord } from "./contract-readers.ts";
import { readHistoryChange, readHistoryEntry } from "./history-contract.ts";
import { CURRENT_CAPTURE_CONTEXT } from "./context-sql.ts";
import {
  courierSection,
  knownInvalidation,
  projectionStatement,
  requireDistinctProjections,
} from "./projection-record.ts";
import type { CourierProjection } from "./projection-record.ts";

const HISTORY_TYPES = [
  "review_decision",
  "shift_validation",
  "relocation_proposal",
  "transfer_custody",
].map((kind) => `history.${kind}`);
function historyProjection(value: unknown): CourierProjection {
  try {
    const row = readHistoryChange(value);
    return {
      kind: row.resource_type,
      id: row.resource_id,
      version: row.resource_version,
      sequence: row.sequence,
      body: row.data,
    };
  } catch (error) {
    if (!(error instanceof CourierContractError) || error.boundary !== "body") throw error;
    return knownInvalidation(value, HISTORY_TYPES);
  }
}
/** Read the accepted row after its guarded upsert, never the unaccepted incoming DTO. */
const retainTerminalProposal: SqlStatement = {
  sql: `INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body)
    SELECT 'lifecycle.reviewed-proposal',source.id,json_extract(history.body,'$.decision.id'),0,
      json_object('sourceEventId',source.id,'pointId',json_extract(source.body,'$.pointId'),
        'proposalId',history.id,'ownerKey',json_extract(source.body,'$.ownerKey'),
        'decision',json_extract(history.body,'$.decision'))
    FROM lifecycle_courier_projection history JOIN lifecycle_courier_projection source
      ON source.kind='lifecycle.owned-source' AND source.id=json_extract(history.body,'$.proposal_event_id')
      AND json_extract(source.body,'$.kind')='relocate'
      AND json_extract(source.body,'$.pointId')=json_extract(history.body,'$.point_id')
    JOIN (${CURRENT_CAPTURE_CONTEXT}) context ON json_extract(context.value,'$.ownerKey')=json_extract(source.body,'$.ownerKey')
    WHERE history.kind='history.relocation_proposal' AND json_extract(history.body,'$.status') IN ('approved','rejected')
      AND json_extract(history.body,'$.decision.decision')=json_extract(history.body,'$.status')
    ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body
      WHERE lifecycle_courier_projection.body<>excluded.body`,
};
export function historyChangeStatements(body: unknown): readonly SqlStatement[] {
  return courierSection(body, "history").map(historyProjection).map(projectionStatement);
}
export function historyBundleStatements(body: unknown): readonly SqlStatement[] {
  const rows = courierSection(body, "history");
  if (rows.length === 0) return [];
  const version = readNonempty(readRecord(body).bundle_version);
  const projections = rows.map(readHistoryEntry).map((entry) => ({
    kind: `history.${entry.kind}`,
    id: entry.id,
    version,
    sequence: 0,
    body: entry,
  }));
  requireDistinctProjections(projections);
  return projections.map(projectionStatement);
}
export function retainedHistoryStatements(): readonly SqlStatement[] {
  return [retainTerminalProposal];
}
