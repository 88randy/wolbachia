import { CourierContractError, readEnvelope, readRecord } from "./contract-readers.ts";
import type { SqlStatement } from "../../db/sql.ts";
export interface CourierProjection {
  readonly kind: string;
  readonly id: string;
  readonly version: string;
  readonly sequence: number;
  readonly body: unknown;
}
export function requireDistinctProjections(rows: readonly CourierProjection[]): void {
  const identities = new Set<string>();
  for (const row of rows) {
    const identity = JSON.stringify([row.kind, row.id.toLowerCase()]);
    if (identities.has(identity)) throw new CourierContractError();
    identities.add(identity);
  }
}
export function projectionStatement(input: CourierProjection): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body) VALUES(?,?,?,?,?)
      ON CONFLICT(kind,id) DO UPDATE SET version=excluded.version,sequence=excluded.sequence,body=excluded.body
      WHERE excluded.sequence > lifecycle_courier_projection.sequence`,
    params: [input.kind, input.id, input.version, input.sequence, JSON.stringify(input.body)],
  };
}
/** Called only after the owning M1 decoder classified BODY failure. Its validated envelope owns invalidation identity. */
export function knownInvalidation(value: unknown, kinds: readonly string[]): CourierProjection {
  const envelope = readEnvelope(value, kinds);
  return {
    kind: envelope.resource_type,
    id: envelope.resource_id,
    version: envelope.resource_version,
    sequence: envelope.sequence,
    body: { _available: false },
  };
}
export function courierSection(body: unknown, key: string): readonly unknown[] {
  const rows = readRecord(body)[key];
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) throw new CourierContractError();
  return rows;
}
