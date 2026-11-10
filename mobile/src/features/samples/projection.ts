import { ownerKey } from "../../attachments/types.ts";
import { removeStatement, setStatement } from "../../db/kv-store.ts";
import { readText, readOptionalText } from "../../db/sql.ts";
import type { SqlExecutor, SqlRow, SqlStatement } from "../../db/sql.ts";
import { readCaptureContext } from "../ovitrap-lifecycle/capture-context-contract.ts";
import type { CaptureTransportHandle } from "../ovitrap-lifecycle/capture-context-contract.ts";
import { CURRENT_CAPTURE_CONTEXT } from "../ovitrap-lifecycle/context-sql.ts";
import { CourierContractError, readRecord } from "../ovitrap-lifecycle/contract-readers.ts";
import type { ChecklistCatalog } from "../shift-open/domain.ts";
import { readSampleSnapshot } from "./projection-contract.ts";
import { SampleError } from "./types.ts";
import type { SampleOrigin, SampleSnapshot, SampleSource } from "./types.ts";

const STATE_KEY = "sample_capture_projection";
export interface SampleProjectionSource {
  readonly snapshot: SampleSnapshot;
  readonly handle: CaptureTransportHandle;
  readonly guard: SqlStatement;
  readonly catalogVersion: string;
  readonly rulesVersion: string;
  readonly origins: readonly SampleOrigin[];
  readonly canUpload: boolean;
}
export class SampleProjectionUnavailable extends SampleError {
  constructor() {
    super("scope");
  }
}
function observation(
  body: unknown,
  handle: CaptureTransportHandle | null,
  source: "bootstrap" | "changes",
) {
  const observed = readCaptureContext({ body, handle, source });
  if (observed.state !== "observed") return { hydrated: false as const, ready: false as const };
  try {
    const root = readRecord(body);
    const snapshot = root.sample_capture === null ? null : readSampleSnapshot(root.sample_capture);
    if (
      snapshot &&
      (snapshot.organization_id !== observed.context.organization_id ||
        snapshot.user_id !== observed.context.user_id)
    )
      throw new CourierContractError();
    return {
      hydrated: true as const,
      ready: snapshot !== null,
      snapshot,
      ownerKey: ownerKey(observed.binding.owner),
      sessionId: observed.binding.sessionId,
      scopeRevision: observed.context.scope_revision,
    };
  } catch (error) {
    if (error instanceof CourierContractError)
      return { hydrated: false as const, ready: false as const };
    throw error;
  }
}
export function sampleBundleStatements(
  body: unknown,
  handle: CaptureTransportHandle | null,
): readonly SqlStatement[] {
  return [setStatement(STATE_KEY, JSON.stringify(observation(body, handle, "bootstrap")))];
}
/** A full snapshot on changes refreshes only an already bootstrapped matching owner frame. */
export function sampleChangeStatements(
  body: unknown,
  handle: CaptureTransportHandle | null,
): readonly SqlStatement[] {
  const next = observation(body, handle, "changes");
  if (!next.hydrated) return [invalidateSampleProjection];
  return [
    {
      sql: `UPDATE kv SET value=? WHERE key=? AND json_extract(value,'$.hydrated')=1
      AND json_extract(value,'$.ownerKey')=? AND json_extract(value,'$.sessionId')=?
      AND json_extract(value,'$.scopeRevision')=?`,
      params: [JSON.stringify(next), STATE_KEY, next.ownerKey, next.sessionId, next.scopeRevision],
    },
  ];
}
export const invalidateSampleProjection = setStatement(
  STATE_KEY,
  '{"hydrated":false,"ready":false}',
);
export const clearSampleProjection: readonly SqlStatement[] = [removeStatement(STATE_KEY)];
export async function needsSampleBootstrap(db: SqlExecutor): Promise<boolean> {
  const rows = await db.query(
    "SELECT 1 FROM kv WHERE key=? AND json_extract(value,'$.hydrated')=1",
    [STATE_KEY],
  );
  return rows.length === 0;
}
const READ = `SELECT metadata.value AS metadata,context.value AS context,profile.value AS profile,
  catalog.value AS catalog,rules.value AS rules,
  EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value='field.upload') AS can_upload
  FROM kv metadata JOIN (${CURRENT_CAPTURE_CONTEXT}) context
  JOIN kv profile ON profile.key='session_profile'
  LEFT JOIN kv catalog ON catalog.key='shift_open_catalog' LEFT JOIN kv rules ON rules.key='shift_open_rules'
  WHERE metadata.key='${STATE_KEY}' AND json_extract(metadata.value,'$.ready')=1
    AND json_extract(metadata.value,'$.ownerKey')=? AND json_extract(metadata.value,'$.sessionId')=? AND json_extract(metadata.value,'$.scopeRevision')=?
    AND json_extract(context.value,'$.ownerKey')=? AND json_extract(context.value,'$.sessionId')=? AND json_extract(context.value,'$.scopeRevision')=? AND json_extract(context.value,'$.authorityRevision')=?
    AND json_extract(profile.value,'$.issuer')=? AND json_extract(profile.value,'$.sessionId')=? AND json_extract(profile.value,'$.userId')=? AND json_extract(profile.value,'$.organization.id')=?
    AND EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value='field_event.sync')
    AND EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value='sample.collect')`;
function params(handle: CaptureTransportHandle) {
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
  ];
}
function guard(row: SqlRow, handle: CaptureTransportHandle): SqlStatement {
  return {
    sql: `SELECT 1 FROM (${READ}) WHERE metadata=? AND context=? AND profile=? AND catalog IS ? AND rules IS ?`,
    params: [
      ...params(handle),
      readText(row, "metadata"),
      readText(row, "context"),
      readText(row, "profile"),
      readOptionalText(row, "catalog"),
      readOptionalText(row, "rules"),
    ],
  };
}
function configuration(row: SqlRow) {
  const catalog =
    typeof row.catalog === "string" ? (JSON.parse(row.catalog) as ChecklistCatalog) : null;
  const rules = typeof row.rules === "string" ? readRecord(JSON.parse(row.rules)) : null;
  return {
    catalogVersion: catalog?.version ?? "",
    rulesVersion: typeof rules?.version === "string" ? rules.version : "",
    origins: (catalog?.sampleOrigins ?? []).map((origin) => ({
      ...origin,
      label: origin.label_es,
    })),
  };
}
function dimensionMatches(value: unknown, id: string | null): boolean {
  if (id === null) return true;
  const dimension = readRecord(value);
  return (
    dimension.mode === "all" ||
    (dimension.mode === "selected" && Array.isArray(dimension.ids) && dimension.ids.includes(id))
  );
}
function sourcePermitted(source: SampleSource, context: unknown): boolean {
  const grants = readRecord(context).grants;
  return (
    Array.isArray(grants) &&
    grants.some((value: unknown) => {
      const grant = readRecord(value);
      return (
        dimensionMatches(grant.centers, source.center_id) &&
        dimensionMatches(grant.quadrants, source.quadrant_id)
      );
    })
  );
}
export async function readSampleProjection(
  db: SqlExecutor,
  handle: CaptureTransportHandle,
): Promise<SampleProjectionSource> {
  if (!handle.isCurrent() || !handle.scopeRevision) throw new SampleProjectionUnavailable();
  const [row] = await db.query(READ, params(handle));
  if (!row || !handle.isCurrent()) throw new SampleProjectionUnavailable();
  const metadata = readRecord(JSON.parse(readText(row, "metadata")));
  const snapshot = readSampleSnapshot(metadata.snapshot),
    context = readRecord(JSON.parse(readText(row, "context"))).context;
  return {
    snapshot: {
      ...snapshot,
      sources: snapshot.sources.filter((source) => sourcePermitted(source, context)),
    },
    handle,
    guard: guard(row, handle),
    canUpload: row.can_upload === 1,
    ...configuration(row),
  };
}
