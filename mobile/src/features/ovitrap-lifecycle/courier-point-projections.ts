import type { SqlStatement } from "../../db/sql.ts";
import { parseChanges } from "../day/assignment-parser.ts";
import { samplingPointChange } from "../day/sampling-point-statements.ts";
import { removeUnavailablePointScope } from "./current-scope.ts";

function mirrorPoint(id: string): readonly SqlStatement[] {
  return [
    {
      sql: "DELETE FROM lifecycle_courier_projection WHERE kind='sampling_point' AND id=?",
      params: [id],
    },
    {
      sql: `INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body)
      SELECT 'sampling_point',id,CAST(version AS TEXT),sequence,payload FROM day_sampling_point
      WHERE id=? AND removed=0`,
      params: [id],
    },
    removeUnavailablePointScope(id),
  ];
}

/** Mirror only the canonical point result, including its version guards and unavailable state, in the same transaction. */
export function courierPointChanges(rows: readonly unknown[]): readonly SqlStatement[] {
  return parseChanges(rows).flatMap((change) => [
    samplingPointChange(change),
    ...mirrorPoint(change.resource_id),
  ]);
}
