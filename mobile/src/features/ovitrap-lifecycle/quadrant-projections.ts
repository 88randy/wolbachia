import { CourierContractError, readNonempty, readRecord } from "./contract-readers.ts";
import { readQuadrantChange, readQuadrantReference } from "./quadrant-contract.ts";
import {
  courierSection,
  knownInvalidation,
  requireDistinctProjections,
} from "./projection-record.ts";
import type { CourierProjection } from "./projection-record.ts";
import type { SqlStatement } from "../../db/sql.ts";

const CURRENT_EPOCH = "COALESCE(json_extract(lifecycle_courier_projection.body,'$.revision'),0)";
const INCOMING_EPOCH = "COALESCE(json_extract(excluded.body,'$.revision'),0)";
function quadrantStatement(row: CourierProjection, bootstrap: boolean): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body) VALUES(?,?,?,?,?)
      ON CONFLICT(kind,id) DO UPDATE SET version=excluded.version,sequence=excluded.sequence,
        body=CASE WHEN json_extract(excluded.body,'$._available')=0
          THEN json_set(lifecycle_courier_projection.body,'$._available',json('false'))
          WHEN ${INCOMING_EPOCH}=${CURRENT_EPOCH} AND json_extract(lifecycle_courier_projection.body,'$.is_closed')=1
          THEN json_set(excluded.body,'$.is_closed',json('true'),'$.closure_id',json_extract(lifecycle_courier_projection.body,'$.closure_id'))
          ELSE excluded.body END
      WHERE (? OR excluded.sequence>lifecycle_courier_projection.sequence)
        AND (${INCOMING_EPOCH}>=${CURRENT_EPOCH} OR json_extract(excluded.body,'$._available')=0)`,
    params: [
      row.kind,
      row.id,
      row.version,
      row.sequence,
      JSON.stringify(row.body),
      bootstrap ? 1 : 0,
    ],
  };
}
function quadrantProjection(value: unknown): CourierProjection {
  try {
    const change = readQuadrantChange(value);
    return {
      kind: change.resource_type,
      id: change.resource_id,
      version: change.resource_version,
      sequence: change.sequence,
      body: { ...change.data, _available: true },
    };
  } catch (error) {
    if (!(error instanceof CourierContractError) || error.boundary !== "body") throw error;
    return knownInvalidation(value, ["quadrant", "block"]);
  }
}
export function quadrantChangeStatements(body: unknown): readonly SqlStatement[] {
  return courierSection(body, "quadrants")
    .map(quadrantProjection)
    .map((row) => quadrantStatement(row, false));
}
export function quadrantBundleStatements(body: unknown): readonly SqlStatement[] {
  const rows = courierSection(body, "quadrants");
  if (rows.length === 0) return [];
  const version = readNonempty(readRecord(body).bundle_version);
  const projections = rows.map(readQuadrantReference).map(({ reference }) => ({
    kind: reference.resource_type,
    id: reference.id,
    version,
    sequence: 0,
    body: { ...reference, _available: true },
  }));
  requireDistinctProjections(projections);
  return projections.map((row) => quadrantStatement(row, true));
}
/** Visibility can disappear; an observed geometry/closure floor cannot be reopened by cache loss. */
export const clearDownloadedProjections: readonly SqlStatement[] = [
  {
    sql: `DELETE FROM lifecycle_courier_projection WHERE kind IN
      ('supply_assignment','ovitrap','sampling_point','history.review_decision','history.shift_validation','history.relocation_proposal','history.transfer_custody')`,
  },
  {
    sql: "UPDATE lifecycle_courier_projection SET body=json_set(body,'$._available',json('false')) WHERE kind IN ('quadrant','block')",
  },
];
