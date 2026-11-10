import { ownerKey } from "../../attachments/types.ts";
import { removeStatement, setStatement } from "../../db/kv-store.ts";
import { readText } from "../../db/sql.ts";
import type { SqlExecutor, SqlRow, SqlStatement } from "../../db/sql.ts";
import type { ProjectionChange } from "../day/types.ts";
import { isRecord, parseChanges } from "../day/assignment-parser.ts";
import { UUID_PATTERN } from "../ovitrap-check/domain.ts";
import { readCaptureContext } from "../ovitrap-lifecycle/capture-context-contract.ts";
import type { CaptureTransportHandle } from "../ovitrap-lifecycle/capture-context-contract.ts";
import { CURRENT_CAPTURE_CONTEXT } from "../ovitrap-lifecycle/context-sql.ts";
import {
  CourierContractError,
  readPositiveInteger,
  readRecord,
  readUuid,
  requireResourceIdentity,
} from "../ovitrap-lifecycle/contract-readers.ts";
import { courierSection } from "../ovitrap-lifecycle/projection-record.ts";
import {
  readReleaseEligibility,
  readReleasePermit,
  readReleaseTask,
  requireDistinctReleaseRows,
} from "./projection-contract.ts";
import type { ReleaseEligibility, ReleasePermit, ReleaseTask } from "./projection-contract.ts";

const STATE_KEY = "release_projection";
const ROW_PREFIX = "release_projection:";
const ROWS_JSON = `(SELECT json_group_array(json_object('key',key,'value',value)) FROM
  (SELECT key,value FROM kv WHERE key GLOB '${ROW_PREFIX}*' ORDER BY key))`;
const QUADRANTS_JSON = `(SELECT json_group_array(json_object('id',id,'body',body)) FROM
  (SELECT id,body FROM lifecycle_courier_projection WHERE kind='quadrant' ORDER BY id))`;
type ReleaseKind = "permit" | "eligibility" | "task";
type ReleaseRecord = ReleasePermit | ReleaseEligibility | ReleaseTask;
interface CachedRelease {
  readonly kind: ReleaseKind;
  readonly sequence: number;
  readonly record: ReleaseRecord | null;
}
export class ReleaseProjectionUnavailable extends Error {
  readonly code = "scope";
}
export interface ReleaseProjectionSource {
  readonly permits: readonly ReleasePermit[];
  readonly eligibility: readonly ReleaseEligibility[];
  readonly tasks: readonly ReleaseTask[];
  readonly handle: CaptureTransportHandle;
  readonly canUpload: boolean;
  /** SELECT predicate to assert in the SAME transaction as any subsequent local mutation. */
  readonly guard: SqlStatement;
}
function cachedStatement(id: string, cached: CachedRelease, bootstrap: boolean): SqlStatement {
  return {
    sql: `INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value
      WHERE ? OR json_extract(excluded.value,'$.sequence')>json_extract(kv.value,'$.sequence')`,
    params: [
      ROW_PREFIX + cached.kind + ":" + id.toLowerCase(),
      JSON.stringify(cached),
      bootstrap ? 1 : 0,
    ],
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
function bootstrapRows(body: unknown): CachedRelease[] {
  const permits = courierSection(body, "permits").map(readReleasePermit);
  const eligibility = courierSection(body, "eligibility").map(readReleaseEligibility);
  const tasks = courierSection(body, "assignments")
    .filter((row) => isRecord(row) && row.kind === "task" && row.action === "release")
    .map(readReleaseTask);
  for (const rows of [permits, eligibility, tasks]) requireDistinctReleaseRows(rows);
  return [
    ...cachedRows("permit", permits),
    ...cachedRows("eligibility", eligibility),
    ...cachedRows("task", tasks),
  ];
}
function cachedRows(kind: ReleaseKind, records: readonly ReleaseRecord[]): CachedRelease[] {
  return records.map((record) => ({ kind, sequence: 0, record }));
}
/** Only a complete, authenticated bootstrap can establish readiness; no missing safety fact is supplied. */
export function releaseBundleStatements(
  body: unknown,
  handle: CaptureTransportHandle | null,
): readonly SqlStatement[] {
  const row = readRecord(body);
  return [
    { sql: `DELETE FROM kv WHERE key GLOB '${ROW_PREFIX}*'` },
    ...bootstrapRows(body).flatMap((cached) =>
      cached.record ? [cachedStatement(cached.record.id, cached, true)] : [],
    ),
    setStatement(
      STATE_KEY,
      JSON.stringify(
        ["permits", "eligibility", "assignments"].every((key) => Array.isArray(row[key]))
          ? binding(body, handle, "bootstrap")
          : { ready: false },
      ),
    ),
  ];
}
function decodedChange(kind: ReleaseKind, value: unknown): ReleaseRecord | null {
  if (kind === "permit") return readReleasePermit(value);
  if (kind === "eligibility") return readReleaseEligibility(value);
  return isRecord(value) && value.action === "release" ? readReleaseTask(value) : null;
}
function changedRecord(kind: ReleaseKind, envelope: ProjectionChange): ReleaseRecord | null {
  try {
    const record = envelope.action === "upsert" ? decodedChange(kind, envelope.data) : null;
    if (record) requireResourceIdentity(envelope.resource_id, record.id);
    return record;
  } catch (error) {
    if (!(error instanceof CourierContractError) || error.boundary === "envelope") throw error;
    return null;
  }
}
function changeStatement(kind: ReleaseKind, envelope: ProjectionChange): SqlStatement {
  readUuid(envelope.resource_id);
  readPositiveInteger(envelope.sequence);
  return cachedStatement(
    envelope.resource_id,
    { kind, sequence: envelope.sequence, record: changedRecord(kind, envelope) },
    false,
  );
}
/** Assignments are shared with older day consumers; only real release bodies can grant authority. */
function assignmentChange(envelope: ProjectionChange): SqlStatement[] {
  const isRelease = isRecord(envelope.data) && envelope.data.action === "release";
  if (isRelease && envelope.resource_type !== "task") throw new CourierContractError("envelope");
  if (envelope.resource_type === "quadrant_assignment") return [];
  if (isRelease || (envelope.resource_type === "task" && envelope.action === "remove"))
    return [changeStatement("task", envelope)];
  if (!UUID_PATTERN.test(envelope.resource_id)) return [];
  return [changeStatement("task", { ...envelope, data: null })];
}
function sectionChanges(body: unknown, section: string, kind: ReleaseKind): SqlStatement[] {
  return parseChanges(readRecord(body)[section]).flatMap((envelope) => {
    if (kind === "task") return assignmentChange(envelope);
    const resourceType = kind === "eligibility" ? "training_eligibility" : kind;
    if (envelope.resource_type !== resourceType) throw new CourierContractError("envelope");
    return [changeStatement(kind, envelope)];
  });
}
export function releaseChangeStatements(
  body: unknown,
  handle: CaptureTransportHandle | null,
): readonly SqlStatement[] {
  return [
    ...sectionChanges(body, "permits", "permit"),
    ...sectionChanges(body, "eligibility", "eligibility"),
    ...sectionChanges(body, "assignments", "task"),
    ...changeBindingStatements(binding(body, handle, "changes")),
  ];
}
function changeBindingStatements(observed: ReturnType<typeof binding>): readonly SqlStatement[] {
  if (!observed.ready) return [invalidateReleaseProjection];
  return [
    {
      sql: `UPDATE kv SET value=json_set(value,'$.ready',json('false')) WHERE key=? AND
        (json_extract(value,'$.ownerKey') IS NOT ? OR json_extract(value,'$.sessionId') IS NOT ? OR json_extract(value,'$.scopeRevision') IS NOT ?)`,
      params: [STATE_KEY, observed.ownerKey, observed.sessionId, observed.scopeRevision],
    },
  ];
}
export const invalidateReleaseProjection = setStatement(STATE_KEY, '{"ready":false}');
export const clearReleaseProjection: readonly SqlStatement[] = [
  { sql: `DELETE FROM kv WHERE key GLOB '${ROW_PREFIX}*'` },
  removeStatement(STATE_KEY),
];
export async function needsReleaseBootstrap(db: SqlExecutor): Promise<boolean> {
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
function paired(context: unknown, center: string, quadrant: string | null): boolean {
  const grants = readRecord(context).grants;
  return (
    Array.isArray(grants) &&
    grants.some((value: unknown) => {
      const grant = readRecord(value);
      return dimensionMatches(grant.centers, center) && dimensionMatches(grant.quadrants, quadrant);
    })
  );
}
const READ_SOURCE = `SELECT metadata.value AS metadata,context.value AS context,profile.value AS profile,${ROWS_JSON} AS rows,${QUADRANTS_JSON} AS quadrants,
  EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value='field.upload') AS can_upload
  FROM kv metadata JOIN (${CURRENT_CAPTURE_CONTEXT}) context JOIN kv profile ON profile.key='session_profile'
  WHERE metadata.key='${STATE_KEY}' AND json_extract(metadata.value,'$.ready')=1
    AND json_extract(metadata.value,'$.ownerKey')=? AND json_extract(metadata.value,'$.sessionId')=? AND json_extract(metadata.value,'$.scopeRevision')=?
    AND json_extract(context.value,'$.ownerKey')=? AND json_extract(context.value,'$.sessionId')=? AND json_extract(context.value,'$.scopeRevision')=? AND json_extract(context.value,'$.authorityRevision')=?
    AND json_extract(profile.value,'$.issuer')=? AND json_extract(profile.value,'$.sessionId')=? AND json_extract(profile.value,'$.userId')=? AND json_extract(profile.value,'$.organization.id')=?
    AND EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value='field_event.sync')`;
function sourceParams(handle: CaptureTransportHandle) {
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
function taskIsPermitted(
  task: ReleaseTask,
  row: SqlRow,
  binding: { context: unknown; handle: CaptureTransportHandle },
): boolean {
  if (task.courier !== binding.handle.owner.userId) return false;
  const quadrants = JSON.parse(readText(row, "quadrants")) as { id: string; body: string }[];
  const stored = quadrants.find(({ id }) => id === task.quadrant_id);
  if (!stored) return false;
  const quadrant = readRecord(JSON.parse(stored.body));
  return (
    quadrant._available === true &&
    typeof quadrant.center_id === "string" &&
    paired(binding.context, quadrant.center_id, task.quadrant_id)
  );
}
function recordsFromRow(row: SqlRow, handle: CaptureTransportHandle) {
  const cached = JSON.parse(readText(row, "rows")) as { value: string }[];
  const context = readRecord(JSON.parse(readText(row, "context"))).context;
  const records = cached
    .map(({ value }) => JSON.parse(value) as CachedRelease)
    .filter(({ record }) => record !== null);
  const permits = records
    .filter(({ kind }) => kind === "permit")
    .map(({ record }) => readReleasePermit(record))
    .filter((permit) => paired(context, permit.center_id, permit.quadrant_id));
  const eligibility = records
    .filter(({ kind }) => kind === "eligibility")
    .map(({ record }) => readReleaseEligibility(record))
    .filter((assessment) => eligibilityIsPermitted(assessment, context, handle));
  const tasks = records
    .filter(({ kind }) => kind === "task")
    .map(({ record }) => readReleaseTask(record))
    .filter((task) => taskIsPermitted(task, row, { context, handle }));
  return { permits, eligibility, tasks };
}
function eligibilityIsPermitted(
  assessment: ReleaseEligibility,
  context: unknown,
  handle: CaptureTransportHandle,
): boolean {
  return (
    assessment.action === "release.record" &&
    assessment.subject_id === handle.owner.userId &&
    assessment.organization_id === handle.owner.organizationId &&
    paired(context, assessment.center_id, assessment.quadrant_id)
  );
}
function sourceGuard(row: SqlRow, handle: CaptureTransportHandle): SqlStatement {
  return {
    sql: `SELECT 1 FROM (${READ_SOURCE}) source WHERE metadata=? AND context=? AND profile=? AND rows=? AND quadrants=?`,
    params: [
      ...sourceParams(handle),
      readText(row, "metadata"),
      readText(row, "context"),
      readText(row, "profile"),
      readText(row, "rows"),
      readText(row, "quadrants"),
    ],
  };
}
/** Original owner/session/revision, paired scope and profile are checked together in one SQLite read. */
export async function readReleaseProjection(
  db: SqlExecutor,
  handle: CaptureTransportHandle,
): Promise<ReleaseProjectionSource> {
  if (!handle.isCurrent() || handle.scopeRevision === null)
    throw new ReleaseProjectionUnavailable("Release projection unavailable.");
  const params = sourceParams(handle);
  const [row] = await db.query(READ_SOURCE, params);
  if (!row || !handle.isCurrent())
    throw new ReleaseProjectionUnavailable("Release projection unavailable.");
  return {
    ...recordsFromRow(row, handle),
    handle,
    canUpload: row.can_upload === 1,
    guard: sourceGuard(row, handle),
  };
}
