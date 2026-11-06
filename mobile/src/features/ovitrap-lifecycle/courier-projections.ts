import { replaceCaptureScope } from "./current-scope.ts";
import { courierPointChanges } from "./courier-point-projections.ts";
import { parseSamplingPoints } from "../day/sampling-point-parser.ts";
import { replaceSamplingPoints } from "../day/sampling-point-statements.ts";
import { reconcileIdentityEffects } from "./identity-effects.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readChange, readOvitrap, readPoint } from "./courier-validation.ts";
interface Projection {
  readonly kind: string;
  readonly id: string;
  readonly version: string;
  readonly sequence: number;
  readonly body: unknown;
}
function statement(input: Projection): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body) VALUES(?,?,?,?,?)
    ON CONFLICT(kind,id) DO UPDATE SET version=excluded.version,sequence=excluded.sequence,body=excluded.body
    WHERE excluded.sequence > lifecycle_courier_projection.sequence`,
    params: [input.kind, input.id, input.version, input.sequence, JSON.stringify(input.body)],
  };
}
function changeStatement(value: unknown): SqlStatement {
  const change = readChange(value, "ovitrap");
  const body = readOvitrap(change.body);
  if (change.id !== body.id) throw new Error("Courier resource identity mismatch.");
  return statement({ ...change, kind: "ovitrap", body });
}
function section(input: unknown, key: "ovitraps" | "sampling_points"): readonly unknown[] {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid courier sections.");
  const rows = (input as Record<string, unknown>)[key];
  if (rows === undefined) return []; // Older B-13 payloads predate these additive sections.
  if (!Array.isArray(rows)) throw new Error("Invalid courier section.");
  return rows;
}
/** Existing B-13 schemas only; no relocation producer/wire schema exists. */
export function courierChangeStatements(changes: unknown): readonly SqlStatement[] {
  const isDrained =
    typeof changes === "object" &&
    changes !== null &&
    "has_more" in changes &&
    changes.has_more === false;
  return [
    ...section(changes, "ovitraps").map(changeStatement),
    ...courierPointChanges(section(changes, "sampling_points")),
    ...(isDrained ? [reconcileIdentityEffects(false)] : []),
  ];
}
/** Replaces downloaded projections only inside the existing DayStore bootstrap transaction. */
export function courierBundleStatements(bundle: unknown): readonly SqlStatement[] {
  const traps = section(bundle, "ovitraps")
    .map((value) => readOvitrap(value))
    .map((body) => ({ kind: "ovitrap", id: body.id, version: body.version, sequence: 0, body }));
  const validPoints = parseSamplingPoints(section(bundle, "sampling_points"));
  const points = validPoints.map((body) => ({
    kind: "sampling_point",
    id: body.id,
    version: String(body.version),
    sequence: 0,
    body,
  }));
  return [
    { sql: "DELETE FROM lifecycle_courier_projection" },
    ...replaceSamplingPoints(validPoints),
    ...[...traps, ...points].map(statement),
    replaceCaptureScope(
      points.map((point) => point.id),
      traps.map((trap) => trap.id),
    ),
    reconcileIdentityEffects(true),
  ];
}
export async function courierPhysical(db: SqlExecutor, id: string) {
  const [row] = await db.query(
    "SELECT body FROM lifecycle_courier_projection WHERE kind='ovitrap' AND id=?",
    [id],
  );
  if (typeof row?.body !== "string") return null;
  const trap = readOvitrap(JSON.parse(row.body));
  const [pointRow] = await db.query(
    "SELECT body FROM lifecycle_courier_projection WHERE kind='sampling_point' AND id=?",
    [trap.sampling_point_id],
  );
  const point = typeof pointRow?.body === "string" ? readPoint(JSON.parse(pointRow.body)) : null;
  return { trap, point };
}
