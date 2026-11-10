import { ownerKey } from "../../attachments/types.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { readText } from "../../db/sql.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { setStatement, removeStatement } from "../../db/kv-store.ts";
import { readCaptureContext } from "../ovitrap-lifecycle/capture-context-contract.ts";
import type { CaptureTransportHandle } from "../ovitrap-lifecycle/capture-context-contract.ts";
import { CURRENT_CAPTURE_CONTEXT } from "../ovitrap-lifecycle/context-sql.ts";
import {
  readEnvelope,
  readRecord,
  requireResourceIdentity,
} from "../ovitrap-lifecycle/contract-readers.ts";
import { courierSection } from "../ovitrap-lifecycle/projection-record.ts";
import { readEligibility, readCertification, readEvaluation } from "./contract.ts";
import type { Eligibility, TrainingRecords, TrainingSource } from "./types.ts";
import { TrainingUnavailable } from "./types.ts";

const STATE_KEY = "training_projection";
const ROW_PREFIX = "training_eligibility:";
const RECORDS_KEY = "training_records";
const ROWS_JSON = `(SELECT json_group_array(json_object('value',value)) FROM
  (SELECT value FROM kv WHERE key GLOB '${ROW_PREFIX}*' ORDER BY key))`;
function binding(
  body: unknown,
  handle: CaptureTransportHandle | null,
  source: "bootstrap" | "changes",
) {
  const observed = readCaptureContext({ body, handle, source });
  return observed.state === "observed"
    ? {
        ready: true,
        ownerKey: ownerKey(observed.binding.owner),
        sessionId: observed.binding.sessionId,
        scopeRevision: observed.context.scope_revision,
      }
    : { ready: false };
}
function cachedStatement(
  id: string,
  row: { sequence: number; eligibility: Eligibility | null },
  bootstrap: boolean,
): SqlStatement {
  return {
    sql: `INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value
      WHERE ? OR json_extract(excluded.value,'$.sequence')>json_extract(kv.value,'$.sequence')`,
    params: [ROW_PREFIX + id.toLowerCase(), JSON.stringify(row), bootstrap ? 1 : 0],
  };
}
export function trainingBundleStatements(
  body: unknown,
  handle: CaptureTransportHandle | null,
): readonly SqlStatement[] {
  const rows = courierSection(body, "eligibility").map(readEligibility);
  if (new Set(rows.map(({ id }) => id.toLowerCase())).size !== rows.length)
    throw new Error("Duplicate training eligibility.");
  return [
    { sql: `DELETE FROM kv WHERE key GLOB '${ROW_PREFIX}*'` },
    ...rows.map((eligibility) =>
      cachedStatement(eligibility.id, { sequence: 0, eligibility }, true),
    ),
    setStatement(
      STATE_KEY,
      JSON.stringify(
        Array.isArray(readRecord(body).eligibility)
          ? binding(body, handle, "bootstrap")
          : { ready: false },
      ),
    ),
  ];
}
function change(value: unknown): SqlStatement {
  const envelope = readEnvelope(value, ["training_eligibility"]);
  let eligibility: Eligibility | null = null;
  try {
    eligibility = readEligibility(envelope.data);
  } catch {
    return cachedStatement(
      envelope.resource_id,
      { sequence: envelope.sequence, eligibility },
      false,
    );
  }
  requireResourceIdentity(envelope.resource_id, eligibility.id);
  return cachedStatement(envelope.resource_id, { sequence: envelope.sequence, eligibility }, false);
}
export function trainingChangeStatements(
  body: unknown,
  handle: CaptureTransportHandle | null,
): readonly SqlStatement[] {
  const observed = binding(body, handle, "changes");
  const invalidation =
    observed.ready && "ownerKey" in observed
      ? {
          sql: `UPDATE kv SET value=json_set(value,'$.ready',json('false')) WHERE key=? AND
      (json_extract(value,'$.ownerKey') IS NOT ? OR json_extract(value,'$.sessionId') IS NOT ? OR json_extract(value,'$.scopeRevision') IS NOT ?)`,
          params: [
            STATE_KEY,
            observed.ownerKey ?? null,
            observed.sessionId ?? null,
            observed.scopeRevision ?? null,
          ],
        }
      : invalidateTrainingProjection;
  return [
    ...courierSection(body, "eligibility").map(change),
    invalidation,
    {
      sql: `UPDATE kv SET value=json_set(value,'$.ready',json('false')) WHERE key='${STATE_KEY}'
      AND EXISTS(SELECT 1 FROM kv WHERE key GLOB '${ROW_PREFIX}*' AND json_type(value,'$.eligibility')='null')`,
    },
  ];
}
export const invalidateTrainingProjection = setStatement(STATE_KEY, '{"ready":false}');
export const clearTrainingProjection: readonly SqlStatement[] = [
  { sql: `DELETE FROM kv WHERE key GLOB '${ROW_PREFIX}*'` },
  removeStatement(STATE_KEY),
  removeStatement(RECORDS_KEY),
];
/** A late REST denial may remove only the original projection, never a successor bootstrap. */
export function clearTrainingProjectionForSource(db: SqlExecutor, source: TrainingSource) {
  return db.runAtomically([
    {
      sql: `DELETE FROM kv WHERE key IN(SELECT key FROM kv
        WHERE (key GLOB '${ROW_PREFIX}*' OR key IN('${RECORDS_KEY}','${STATE_KEY}'))
          AND EXISTS(${source.guard.sql}))`,
      params: source.guard.params ?? [],
    },
  ]);
}
export async function needsTrainingBootstrap(db: SqlExecutor): Promise<boolean> {
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
function contextMatches(row: { center_id: string; quadrant_id: string | null }, context: unknown) {
  const grants = readRecord(context).grants;
  return (
    Array.isArray(grants) &&
    grants.some((value: unknown) => {
      const grant = readRecord(value);
      return (
        dimensionMatches(grant.centers, row.center_id) &&
        dimensionMatches(grant.quadrants, row.quadrant_id)
      );
    })
  );
}
const READ_SOURCE = `SELECT metadata.value AS metadata,context.value AS context,profile.value AS profile,${ROWS_JSON} AS eligibility_rows
  FROM kv metadata JOIN (${CURRENT_CAPTURE_CONTEXT}) context JOIN kv profile ON profile.key='session_profile'
  WHERE metadata.key='${STATE_KEY}' AND json_extract(metadata.value,'$.ready')=1
    AND json_extract(metadata.value,'$.ownerKey')=? AND json_extract(metadata.value,'$.sessionId')=?
    AND json_extract(metadata.value,'$.scopeRevision')=json_extract(context.value,'$.scopeRevision')
    AND json_extract(context.value,'$.ownerKey')=? AND json_extract(context.value,'$.sessionId')=?
    AND json_extract(profile.value,'$.issuer')=? AND json_extract(profile.value,'$.sessionId')=?
    AND json_extract(profile.value,'$.userId')=? AND json_extract(profile.value,'$.organization.id')=?`;
function identityParams(identity: EvidenceIdentity) {
  return [
    ownerKey(identity.owner),
    identity.sessionId,
    ownerKey(identity.owner),
    identity.sessionId,
    identity.owner.issuer,
    identity.sessionId,
    identity.owner.userId,
    identity.owner.organizationId,
  ];
}
function readEligibilityRows(raw: string, identity: EvidenceIdentity, context: unknown) {
  const rows = JSON.parse(raw) as { readonly value: string }[];
  const values = rows.map((row) => readRecord(JSON.parse(row.value)).eligibility);
  if (values.some((value) => value === null))
    throw new TrainingUnavailable("Unreadable eligibility requires a complete bootstrap.");
  return values
    .map(readEligibility)
    .filter(
      (row) =>
        row.subject_id === identity.owner.userId &&
        row.organization_id === identity.owner.organizationId &&
        contextMatches(row, context),
    );
}
async function readRecords(db: SqlExecutor, metadata: string): Promise<TrainingRecords | null> {
  const [row] = await db.query(
    "SELECT value FROM kv WHERE key=? AND json_extract(value,'$.binding')=json(?)",
    [RECORDS_KEY, metadata],
  );
  return row ? (readRecord(JSON.parse(readText(row, "value"))).records as TrainingRecords) : null;
}
function permittedRecords(
  records: TrainingRecords | null,
  input: { context: unknown; permissions: unknown; identity: EvidenceIdentity },
) {
  if (records === null) return null;
  const { context, permissions, identity } = input;
  const canRead = (permission: string) =>
    Array.isArray(permissions) && permissions.includes(permission);
  return {
    ...records,
    certificates: canRead("training.read")
      ? records.certificates
          .map(readCertification)
          .filter((row) => row.subject_id === identity.owner.userId && contextMatches(row, context))
      : [],
    evaluations: canRead("evaluation.read")
      ? records.evaluations
          .map(readEvaluation)
          .filter((row) => row.subject_id === identity.owner.userId && contextMatches(row, context))
      : [],
  };
}
/** Caller holds the existing short projection writer. Its original raw rows fence later REST publication. */
export async function readTrainingSource(
  db: SqlExecutor,
  identity: EvidenceIdentity,
): Promise<TrainingSource> {
  const params = identityParams(identity);
  const [row] = await db.query(READ_SOURCE, params);
  if (!row) throw new TrainingUnavailable("Training projections need an authenticated bootstrap.");
  const metadata = readText(row, "metadata"),
    context = readText(row, "context"),
    profile = readText(row, "profile");
  const permissions = readRecord(JSON.parse(profile)).permissions;
  return {
    eligibility: readEligibilityRows(
      readText(row, "eligibility_rows"),
      identity,
      readRecord(JSON.parse(context)).context,
    ),
    records: permittedRecords(await readRecords(db, metadata), {
      context: readRecord(JSON.parse(context)).context,
      permissions,
      identity,
    }),
    canReadTraining: Array.isArray(permissions) && permissions.includes("training.read"),
    canReadEvaluations: Array.isArray(permissions) && permissions.includes("evaluation.read"),
    guard: {
      sql: `SELECT 1 FROM (${READ_SOURCE}) WHERE metadata=? AND context=? AND profile=? AND eligibility_rows=?`,
      params: [...params, metadata, context, profile, readText(row, "eligibility_rows")],
    },
  };
}
export function saveTrainingRecords(
  db: SqlExecutor,
  source: TrainingSource,
  records: TrainingRecords,
): Promise<void> {
  return db.runAtomically([
    {
      sql: `INSERT INTO kv(key,value) VALUES(?,CASE WHEN EXISTS(${source.guard.sql})
      THEN json_object('binding',json((SELECT value FROM kv WHERE key='${STATE_KEY}')),'records',json(?)) ELSE NULL END)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      params: [RECORDS_KEY, ...(source.guard.params ?? []), JSON.stringify(records)],
    },
  ]);
}
