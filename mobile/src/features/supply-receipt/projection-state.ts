import { ownerKey } from "../../attachments/types.ts";
import type { SqlExecutor, SqlStatement, SqlRow } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import { setStatement, removeStatement } from "../../db/kv-store.ts";
import { readCaptureContext } from "../ovitrap-lifecycle/capture-context-contract.ts";
import type { CaptureTransportHandle } from "../ovitrap-lifecycle/capture-context-contract.ts";
import { CURRENT_CAPTURE_CONTEXT } from "../ovitrap-lifecycle/context-sql.ts";
import {
  CourierContractError,
  readEnvelope,
  readRecord,
  requireResourceIdentity,
} from "../ovitrap-lifecycle/contract-readers.ts";
import { courierSection } from "../ovitrap-lifecycle/projection-record.ts";
import { readSupplyAssignment } from "./projection-contract.ts";
import type {
  SupplyAssignment,
  SupplyProjectionSource,
  SupplyProjectionAccess,
} from "./projection-types.ts";
import { SupplyProjectionUnavailable } from "./projection-types.ts";

const STATE_KEY = "supply_receipt_projection";
const ROW_PREFIX = "supply_receipt_assignment:";
const ROWS_JSON = `(SELECT json_group_array(json_object('key',key,'value',value)) FROM
  (SELECT key,value FROM kv WHERE key GLOB '${ROW_PREFIX}*' ORDER BY key))`;
interface CachedSupply {
  readonly sequence: number;
  readonly resourceVersion: string;
  readonly assignment: SupplyAssignment | null;
}
function cachedStatement(id: string, cached: CachedSupply, bootstrap: boolean): SqlStatement {
  return {
    sql: `INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value
      WHERE ? OR json_extract(excluded.value,'$.sequence')>json_extract(kv.value,'$.sequence')`,
    params: [ROW_PREFIX + id.toLowerCase(), JSON.stringify(cached), bootstrap ? 1 : 0],
  };
}
function binding(
  body: unknown,
  handle: CaptureTransportHandle | null,
  source: "bootstrap" | "changes",
) {
  const observed = readCaptureContext({ body, handle, source });
  return observed.state === "observed"
    ? {
        ready: true as const,
        ownerKey: ownerKey(observed.binding.owner),
        sessionId: observed.binding.sessionId,
        scopeRevision: observed.context.scope_revision,
      }
    : { ready: false as const };
}
export function supplyBundleStatements(
  body: unknown,
  handle: CaptureTransportHandle | null,
): readonly SqlStatement[] {
  const row = readRecord(body),
    assignments = courierSection(body, "supplies").map(readSupplyAssignment);
  if (new Set(assignments.map(({ id }) => id.toLowerCase())).size !== assignments.length)
    throw new CourierContractError();
  return [
    { sql: `DELETE FROM kv WHERE key GLOB '${ROW_PREFIX}*'` },
    ...assignments.map((assignment) =>
      cachedStatement(
        assignment.id,
        { sequence: 0, resourceVersion: String(assignment.revision), assignment },
        true,
      ),
    ),
    setStatement(
      STATE_KEY,
      JSON.stringify(
        Array.isArray(row.supplies) ? binding(body, handle, "bootstrap") : { ready: false },
      ),
    ),
  ];
}
function change(value: unknown): SqlStatement {
  const envelope = readEnvelope(value, ["supply_assignment"]);
  let assignment: SupplyAssignment | null = null;
  try {
    assignment = readSupplyAssignment(envelope.data);
    requireResourceIdentity(envelope.resource_id, assignment.id);
  } catch (error) {
    if (!(error instanceof CourierContractError) || error.boundary === "envelope") throw error;
  }
  return cachedStatement(
    envelope.resource_id,
    { sequence: envelope.sequence, resourceVersion: envelope.resource_version, assignment },
    false,
  );
}
export function supplyChangeStatements(
  body: unknown,
  handle: CaptureTransportHandle | null,
): readonly SqlStatement[] {
  const observed = binding(body, handle, "changes");
  return [
    ...courierSection(body, "supplies").map(change),
    ...(observed.ready && "ownerKey" in observed
      ? [
          {
            sql: `UPDATE kv SET value=json_set(value,'$.ready',json('false')) WHERE key=? AND
        (json_extract(value,'$.ownerKey') IS NOT ? OR json_extract(value,'$.sessionId') IS NOT ? OR json_extract(value,'$.scopeRevision') IS NOT ?)`,
            params: [STATE_KEY, observed.ownerKey, observed.sessionId, observed.scopeRevision],
          },
        ]
      : [invalidateSupplyProjection]),
  ];
}
export const invalidateSupplyProjection: SqlStatement = setStatement(STATE_KEY, '{"ready":false}');
export const clearSupplyProjection: readonly SqlStatement[] = [
  { sql: `DELETE FROM kv WHERE key GLOB '${ROW_PREFIX}*'` },
  removeStatement(STATE_KEY),
];
export async function needsSupplyBootstrap(db: SqlExecutor): Promise<boolean> {
  const rows = await db.query("SELECT 1 FROM kv WHERE key=? AND json_extract(value,'$.ready')=1", [
    STATE_KEY,
  ]);
  return rows.length === 0;
}
function dimensionMatches(value: unknown, id: string | null): boolean {
  if (id === null) return true;
  const dimension = readRecord(value);
  return (
    dimension.mode === "all" ||
    (dimension.mode === "selected" && Array.isArray(dimension.ids) && dimension.ids.includes(id))
  );
}
function permitted(
  assignment: SupplyAssignment,
  context: unknown,
  handle: CaptureTransportHandle,
): boolean {
  if (
    assignment.courier_id !== handle.owner.userId ||
    assignment.organization_id !== handle.owner.organizationId
  )
    return false;
  const grants = readRecord(context).grants;
  return (
    Array.isArray(grants) &&
    grants.some((value: unknown) => {
      const grant = readRecord(value);
      return (
        dimensionMatches(grant.centers, assignment.center_id) &&
        dimensionMatches(grant.quadrants, assignment.quadrant_id)
      );
    })
  );
}
const READ_SOURCE = `SELECT metadata.value AS metadata,context.value AS context,profile.value AS profile,${ROWS_JSON} AS rows
  FROM kv metadata JOIN (${CURRENT_CAPTURE_CONTEXT}) context JOIN kv profile ON profile.key='session_profile'
  WHERE metadata.key='${STATE_KEY}' AND json_extract(metadata.value,'$.ready')=1
    AND json_extract(metadata.value,'$.ownerKey')=? AND json_extract(metadata.value,'$.sessionId')=?
    AND json_extract(metadata.value,'$.scopeRevision')=?
    AND json_extract(context.value,'$.ownerKey')=? AND json_extract(context.value,'$.sessionId')=?
    AND json_extract(context.value,'$.scopeRevision')=? AND json_extract(context.value,'$.authorityRevision')=?
    AND json_extract(profile.value,'$.issuer')=? AND json_extract(profile.value,'$.sessionId')=?
    AND json_extract(profile.value,'$.userId')=? AND json_extract(profile.value,'$.organization.id')=?
    AND EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value=?)
    AND (?=0 OR EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value='field.upload'))`;
/** One short projection read. Its exact raw CAS is reusable by the caller's atomic draft/outbox write. */
function sourceParams(handle: CaptureTransportHandle, access: SupplyProjectionAccess) {
  const key = ownerKey(handle.owner);
  return [
    key,
    handle.sessionId,
    handle.scopeRevision,
    key,
    handle.sessionId,
    handle.scopeRevision,
    handle.revision,
    handle.owner.issuer,
    handle.sessionId,
    handle.owner.userId,
    handle.owner.organizationId,
    `supply_assignment.${access}`,
    access === "receive" ? 1 : 0,
  ];
}
function assignmentsFromRow(row: SqlRow, handle: CaptureTransportHandle) {
  const stored = JSON.parse(readText(row, "rows")) as { value: string }[];
  const context = readRecord(JSON.parse(readText(row, "context"))).context;
  return stored
    .map(({ value }) => (JSON.parse(value) as CachedSupply).assignment)
    .filter((assignment): assignment is SupplyAssignment => assignment !== null)
    .map(readSupplyAssignment)
    .filter((assignment) => permitted(assignment, context, handle));
}
export async function readSupplyAssignments(
  db: SqlExecutor,
  handle: CaptureTransportHandle,
  access: SupplyProjectionAccess = "receive",
): Promise<SupplyProjectionSource> {
  if (!handle.isCurrent() || handle.scopeRevision === null)
    throw new SupplyProjectionUnavailable("Supply capture context unavailable.");
  const params = sourceParams(handle, access);
  const [row] = await db.query(READ_SOURCE, params);
  if (!row || !handle.isCurrent())
    throw new SupplyProjectionUnavailable("Supply capture context unavailable.");
  return {
    assignments: assignmentsFromRow(row, handle),
    handle,
    guard: {
      sql: `SELECT 1 FROM (${READ_SOURCE}) source WHERE metadata=? AND context=? AND profile=? AND rows=?`,
      params: [
        ...params,
        readText(row, "metadata"),
        readText(row, "context"),
        readText(row, "profile"),
        readText(row, "rows"),
      ],
    },
  };
}
