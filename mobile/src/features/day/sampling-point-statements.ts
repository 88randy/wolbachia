import type { SqlStatement } from "../../db/sql.ts";
import type { ProjectionChange } from "./types.ts";
import { parseSamplingPoint } from "./sampling-point-parser.ts";
import type { SamplingPoint } from "./sampling-point-parser.ts";
interface PointProjection {
  readonly id: string;
  readonly version: number;
  readonly sequence: number;
  readonly point: SamplingPoint | null;
}
function statement(input: PointProjection): SqlStatement {
  return {
    sql: `INSERT INTO day_sampling_point(id,version,sequence,payload,removed) VALUES(?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET version=MAX(day_sampling_point.version,excluded.version),
      sequence=excluded.sequence,payload=excluded.payload,removed=excluded.removed
      WHERE excluded.sequence>day_sampling_point.sequence AND (excluded.payload IS NULL OR excluded.version>day_sampling_point.version)`,
    params: [
      input.id,
      input.version,
      input.sequence,
      input.point === null ? null : JSON.stringify(input.point),
      Number(input.point === null),
    ],
  };
}
/** Upsert-only on today's wire; a generic remove or malformed row invalidates its known identity defensively. */
export function samplingPointChange(change: ProjectionChange): SqlStatement {
  const point = parseSamplingPoint(change.data);
  const version = Number(change.resource_version);
  const isValid =
    change.action === "upsert" &&
    change.resource_type === "sampling_point" &&
    point?.id === change.resource_id &&
    String(point.version) === change.resource_version;
  return statement({
    id: change.resource_id,
    sequence: change.sequence,
    version: Number.isSafeInteger(version) && version > 0 ? version : 0,
    point: isValid ? point : null,
  });
}
/** Authoritative bootstrap is a replacement, independent of prior delta sequence/version floors. */
export function replaceSamplingPoints(points: readonly SamplingPoint[]): readonly SqlStatement[] {
  return [
    { sql: "DELETE FROM day_sampling_point" },
    ...points.map((point) =>
      statement({ id: point.id, version: point.version, sequence: 0, point }),
    ),
  ];
}
