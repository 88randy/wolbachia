import type { Schemas } from "@wolbachia/api-client";
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
function changeStatement(value: unknown, kind: "ovitrap" | "sampling_point"): SqlStatement {
  const change = readChange(value, kind);
  const body = kind === "ovitrap" ? readOvitrap(change.body) : readPoint(change.body);
  if (change.id !== body.id) throw new Error("Courier resource identity mismatch.");
  return statement({ ...change, kind, body });
}
/** Existing B-13 schemas only; no relocation producer/wire schema exists. */
export function courierChangeStatements(
  changes: Pick<Schemas["Changes"], "ovitraps" | "sampling_points">,
): readonly SqlStatement[] {
  return [
    ...changes.ovitraps.map((change) => changeStatement(change, "ovitrap")),
    ...changes.sampling_points.map((change) => changeStatement(change, "sampling_point")),
  ];
}
/** Replaces downloaded projections only; the M-01 bootstrap consumer owns calling this boundary. */
export function courierBundleStatements(
  bundle: Pick<Schemas["Bootstrap"], "ovitraps" | "sampling_points">,
): readonly SqlStatement[] {
  const traps = bundle.ovitraps
    .map((value) => readOvitrap(value))
    .map((body) => ({ kind: "ovitrap", id: body.id, version: body.version, sequence: 0, body }));
  const points = bundle.sampling_points
    .map((value) => readPoint(value))
    .map((body) => ({
      kind: "sampling_point",
      id: body.id,
      version: String(body.version),
      sequence: 0,
      body,
    }));
  return [
    { sql: "DELETE FROM lifecycle_courier_projection" },
    ...[...traps, ...points].map(statement),
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
