import type { CredentialStore } from "../../auth/credential-store.ts";
import type { SqlExecutor, SqlRow } from "../../db/sql.ts";
import { readInteger, readText } from "../../db/sql.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import { ownerKey } from "../../attachments/types.ts";
import { parseSamplingPoint } from "../day/sampling-point-parser.ts";
import { LifecycleGateError } from "./action-error-key.ts";
import { StaleCaptureError } from "./capture-identity.ts";
import { CURRENT_CAPTURE_CONTEXT, capturePointScopeSql } from "./context-sql.ts";
import { physicalIdentityStateSql } from "./physical-identity-state.ts";
import { readQuadrantReference } from "./quadrant-contract.ts";
import { readCaptureContext } from "./capture-context-contract.ts";
import type { CaptureTransportHandle } from "./capture-context-contract.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import type {
  Configuration,
  LifecycleSource,
  LifecycleSourceRequest,
  LifecycleSourceTurn,
  LifecycleSourcePort,
} from "./types.ts";

export type LifecycleSourceReader = <T>(
  request: LifecycleSourceRequest | null,
  use: (turn: LifecycleSourceTurn) => Promise<T>,
) => Promise<T>;
interface BundleSource {
  captureLifecycleSource(): LifecycleSourceReader;
}
const EMPTY: Configuration = { catalog: null, rules: null };
/** Private configuration metadata is never a grant or a replacement for the original authority. */
export function boundConfiguration(
  value: string | null,
  handle: CaptureTransportHandle,
): Configuration {
  if (value === null) return EMPTY;
  const row = JSON.parse(value) as Configuration & {
    captureBinding?: { ownerKey: string; sessionId: string; revision: number };
  };
  const binding = row.captureBinding;
  return binding?.ownerKey === ownerKey(handle.owner) && binding.sessionId === handle.sessionId
    ? { catalog: row.catalog, rules: row.rules }
    : EMPTY;
}
function organization(
  value: string,
  handle: CaptureTransportHandle,
): LifecycleSource["organization"] {
  const profile = JSON.parse(value) as {
    issuer?: string;
    sessionId?: string;
    userId?: string;
    organization?: LifecycleSource["organization"];
  };
  const org = profile.organization;
  if (
    profile.issuer !== handle.owner.issuer ||
    profile.sessionId !== handle.sessionId ||
    profile.userId !== handle.owner.userId ||
    org?.id !== handle.owner.organizationId ||
    !["iso", "mmwr"].includes(org.epi_week)
  )
    throw new LifecycleGateError("scope");
  return { id: org.id, timezone: validTimezone(org.timezone), epi_week: org.epi_week };
}
function validTimezone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new LifecycleGateError("scope");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
  } catch (error) {
    if (error instanceof RangeError) throw new LifecycleGateError("scope");
    throw error;
  }
  return value;
}
interface SourceContext {
  readonly handle: CaptureTransportHandle;
  readonly ownerFence: EvidenceFence;
  readonly organization: LifecycleSource["organization"];
  readonly configuration: Configuration;
  readonly context: LifecycleSource["context"];
}
const CONTEXT_QUERY = `SELECT context.value,profile.value AS profile,config.value AS config,a.generation
  FROM (${CURRENT_CAPTURE_CONTEXT}) context JOIN kv profile ON profile.key='session_profile'
  JOIN attachment_context a ON a.slot=1 AND a.owner_key=? AND a.session_id=? AND a.is_active=1
  LEFT JOIN kv config ON config.key='lifecycle_configuration'
  WHERE json_extract(context.value,'$.ownerKey')=? AND json_extract(context.value,'$.sessionId')=?
    AND json_extract(context.value,'$.authorityRevision')=?`;
function contextFromRow(row: SqlRow, handle: CaptureTransportHandle): SourceContext {
  const stored = JSON.parse(readText(row, "value")) as { context: unknown };
  const observed = readCaptureContext({
    source: "changes",
    body: { capture_context: stored.context },
    handle,
  });
  if (observed.state !== "observed") throw new LifecycleGateError("scope");
  return {
    handle,
    ownerFence: {
      ownerKey: ownerKey(handle.owner),
      sessionId: handle.sessionId,
      generation: readInteger(row, "generation"),
    },
    organization: organization(readText(row, "profile"), handle),
    context: observed.context,
    configuration: boundConfiguration(typeof row.config === "string" ? row.config : null, handle),
  };
}
async function sourceContext(
  db: SqlExecutor,
  handle: CaptureTransportHandle,
): Promise<SourceContext> {
  if (!handle.isCurrent() || handle.scopeRevision === null) throw new LifecycleGateError("scope");
  const key = ownerKey(handle.owner);
  const [row] = await db.query(CONTEXT_QUERY, [
    key,
    handle.sessionId,
    key,
    handle.sessionId,
    handle.revision,
  ]);
  if (!row || !handle.isCurrent()) throw new LifecycleGateError("scope");
  return contextFromRow(row, handle);
}
const LOCAL_EFFECTIVE = `e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS(
  SELECT 1 FROM lifecycle_void v JOIN outbox_event ve ON ve.id=v.event_id
    WHERE v.target_event_id=c.event_id AND ve.local_status NOT IN ('rejected','in_review'))`;
function candidates(request: LifecycleSourceRequest) {
  const owned = `FROM lifecycle_capture c JOIN outbox_event e ON e.id=c.event_id
    JOIN lifecycle_courier_projection origin ON origin.kind='lifecycle.owned-source' AND origin.id=c.event_id`;
  if (request.kind === "correction")
    return {
      sql: `SELECT c.ovitrap_id AS id,c.point_id,'owned-local' AS provenance,
    NULL AS version,NULL AS sequence,c.event_id,e.local_status,'capture' AS relation ${owned}
    WHERE c.event_id=? AND json_extract(origin.body,'$.ownerKey')=?`,
      params: [request.sourceEventId],
    };
  return {
    sql: `SELECT id,json_extract(body,'$.sampling_point_id') AS point_id,'downloaded' AS provenance,
    version,sequence,NULL AS event_id,NULL AS local_status,NULL AS relation FROM lifecycle_courier_projection
    WHERE kind='ovitrap' AND id=? UNION ALL SELECT json_extract(c.draft,'$.replacementId'),c.point_id,'owned-local',
    NULL,NULL,c.event_id,e.local_status,'replacement' ${owned} WHERE c.kind='replace'
      AND json_extract(c.draft,'$.replacementId')=? AND json_extract(origin.body,'$.ownerKey')=? AND ${LOCAL_EFFECTIVE}`,
    params: [request.ovitrapId, request.ovitrapId],
  };
}
function physical(row: SqlRow): LifecycleSource["physical"] {
  const id = readText(row, "id");
  if (row.provenance === "downloaded")
    return {
      kind: "downloaded",
      id,
      version: readText(row, "version"),
      sequence: readInteger(row, "sequence"),
    };
  const status = readText(row, "local_status");
  if (!["pending", "sending", "error", "sent", "in_review", "rejected"].includes(status))
    throw new LifecycleGateError("scope");
  return {
    kind: "owned-local",
    id,
    sourceEventId: readText(row, "event_id"),
    relation: row.relation === "replacement" ? "replacement" : "capture",
    status: status as Extract<LifecycleSource["physical"], { kind: "owned-local" }>["status"],
    receipt:
      row.projection_sequence === null
        ? null
        : {
            projectionSequence: readInteger(row, "projection_sequence"),
            isReconciled: row.is_reconciled === 1,
          },
  };
}
function sourceQuery(request: LifecycleSourceRequest, context: SourceContext) {
  const candidate = candidates(request);
  return {
    sql: `WITH physical AS (${candidate.sql}) SELECT physical.*,point.payload,quadrant.body AS quadrant,
    receipt.projection_sequence,receipt.is_reconciled,${physicalIdentityStateSql({ idSql: "physical.id", pointIdSql: "physical.point_id" })} AS retired
    FROM physical JOIN day_sampling_point point ON point.id=physical.point_id AND point.removed=0
    JOIN lifecycle_courier_projection mirror ON mirror.kind='sampling_point' AND mirror.id=point.id
      AND json_extract(mirror.body,'$.version')=point.version AND json_extract(mirror.body,'$.is_retired')=0
    JOIN lifecycle_courier_projection quadrant ON quadrant.kind='quadrant' AND quadrant.id=json_extract(point.payload,'$.quadrant_id')
    LEFT JOIN lifecycle_receipt receipt ON receipt.event_id=physical.event_id AND receipt.ovitrap_id=physical.id
    WHERE EXISTS(${capturePointScopeSql("point.id", request.kind === "new")}) AND ${CURRENT_FENCE}
    ORDER BY CASE physical.provenance WHEN 'downloaded' THEN 0 ELSE 1 END LIMIT 1`,
    params: [...candidate.params, context.ownerFence.ownerKey, ...fenceParams(context.ownerFence)],
  };
}
function pointContext(row: SqlRow) {
  const point = parseSamplingPoint(JSON.parse(readText(row, "payload")));
  const { reference: epoch } = readQuadrantReference(JSON.parse(readText(row, "quadrant")));
  if (!point) throw new LifecycleGateError("scope");
  const [lng, lat] = point.location;
  if (lng === undefined || lat === undefined) throw new LifecycleGateError("scope");
  return {
    point: {
      id: point.id,
      code: point.code,
      lng,
      lat,
      version: point.version,
      blockId: point.block_id,
      quadrantId: point.quadrant_id,
      centerId: epoch.center_id,
    },
    epoch,
  };
}
async function sourceFor(
  db: SqlExecutor,
  request: LifecycleSourceRequest,
  context: SourceContext,
): Promise<LifecycleSource> {
  const query = sourceQuery(request, context);
  const [row] = await db.query(query.sql, query.params);
  if (!row || !context.handle.isCurrent()) throw new LifecycleGateError("scope");
  return {
    ...context.configuration,
    context: context.context,
    physical: physical(row),
    isRetired: row.retired === 1,
    ...pointContext(row),
    organization: context.organization,
  };
}
/** All SQL reads use the original short writer. The callback itself is deliberately invoked by the caller outside it. */
export async function readLifecycleSource(
  db: SqlExecutor,
  handle: CaptureTransportHandle,
  request: LifecycleSourceRequest | null,
) {
  const context = await sourceContext(db, handle);
  const source = request === null ? null : await sourceFor(db, request, context);
  const [current] = await db.query(
    `SELECT ${CURRENT_FENCE} AS current, EXISTS(SELECT 1 FROM day_sampling_point candidate
    WHERE EXISTS(${capturePointScopeSql("candidate.id")})) AS can_capture`,
    fenceParams(context.ownerFence),
  );
  if (!current?.current || !handle.isCurrent()) throw new LifecycleGateError("scope");
  return { source, handle, ownerFence: context.ownerFence, canCapture: current.can_capture === 1 };
}
/** Capture interaction and transport synchronously; only SQL admission acquires credentials then projections. */
async function requireDraft(db: SqlExecutor, expectedEventId: string | null): Promise<void> {
  const [row] = await db.query(
    "SELECT json_extract(draft,'$.eventId') AS id FROM lifecycle_draft WHERE slot=1",
  );
  if ((row?.id ?? null) !== expectedEventId) throw new StaleCaptureError();
}
interface PortDependencies {
  readonly bundle: BundleSource;
  readonly credentials: Pick<CredentialStore, "unlockGate" | "isUnlocked" | "runExclusive">;
  readonly db: SqlExecutor;
}
async function admitCommit<T>(
  input: { deps: PortDependencies; expectedEventId: string | null; current: () => boolean },
  turn: LifecycleSourceTurn,
  sqlOnly: () => Promise<T>,
): Promise<T> {
  if (!input.current()) throw new LifecycleGateError("scope");
  await requireDraft(input.deps.db, input.expectedEventId);
  if (!input.current()) throw new LifecycleGateError("scope");
  return input.deps.credentials.runExclusive(() =>
    turn.write(() => {
      if (!input.current() || !turn.handle.isCurrent()) throw new LifecycleGateError("scope");
      return sqlOnly();
    }),
  );
}
function captureOperation(
  deps: PortDependencies,
  expectedEventId: string | null,
  isDraftCurrent: () => boolean,
) {
  const gate = deps.credentials.unlockGate(),
    read = deps.bundle.captureLifecycleSource();
  const current = () =>
    deps.credentials.isUnlocked() && deps.credentials.unlockGate() === gate && isDraftCurrent();
  return {
    read,
    expectedEventId,
    isCurrent: current,
    admit: <T>(turn: LifecycleSourceTurn, sqlOnly: () => Promise<T>) =>
      admitCommit({ deps, expectedEventId, current }, turn, sqlOnly),
  };
}
export function createLifecycleSourcePort(
  bundle: BundleSource,
  credentials: PortDependencies["credentials"],
  db: SqlExecutor,
): LifecycleSourcePort {
  return {
    capture: (id, current) => captureOperation({ bundle, credentials, db }, id, current),
    read<T>(
      request: LifecycleSourceRequest | null,
      use: (turn: LifecycleSourceTurn) => Promise<T>,
    ): Promise<T> {
      return bundle.captureLifecycleSource()(request, use);
    },
  };
}
