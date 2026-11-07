import {
  courierBundleStatements,
  courierChangeStatements,
} from "../ovitrap-lifecycle/courier-projections.ts";
import { revokeCaptureScope } from "../ovitrap-lifecycle/current-scope.ts";
import {
  advanceCaptureTransport,
  captureContextCas,
  captureRecoveryStatements,
  contextPublication,
  invalidateCaptureContext,
  readCaptureTransport,
} from "../ovitrap-lifecycle/context-state.ts";
import {
  CURRENT_CAPTURE_CONTEXT,
  LIFECYCLE_BOOTSTRAP_PENDING,
} from "../ovitrap-lifecycle/context-sql.ts";
import { clearDownloadedProjections } from "../ovitrap-lifecycle/quadrant-projections.ts";
import { retainedHistoryStatements } from "../ovitrap-lifecycle/history-projections.ts";
import type { CaptureTransportHandle } from "../ovitrap-lifecycle/capture-context-contract.ts";
import { readLifecycleSource } from "../ovitrap-lifecycle/source-context.ts";
import { readCurrentTask } from "./current-task.ts";
import type { TaskOwner } from "./current-task.ts";
import type { LifecycleSourceRequest } from "../ovitrap-lifecycle/types.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { LOCATED_ASSIGNMENTS } from "./task-locations.ts";
import { INVALIDATE_ATTACHMENTS } from "../../attachments/schema.ts";
import { setStatement, removeStatement, KV_KEYS } from "../../db/kv-store.ts";
import { readText } from "../../db/sql.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import {
  isRecord,
  isQuadrantAssignment,
  parseAssignment,
  parseManifest,
  parseChanges,
} from "./assignment-parser.ts";
import { parseBundle } from "./bundle-parser.ts";
import {
  upsertTask,
  removeTask,
  removeMissingTasks,
  upsertManifest,
  removeManifest,
} from "./projection-statements.ts";
import type { AssignedTask, BundleMeta, DayCache, MapManifest, ProjectionChange } from "./types.ts";
function assignmentStatement(change: ProjectionChange) {
  if (change.action === "remove") return { statement: removeTask(change), isUnreadable: false };
  const task = parseAssignment(change.data);
  const isUnreadable = task === null || task.id !== change.resource_id;
  return {
    statement: task !== null && !isUnreadable ? upsertTask(task, change) : removeTask(change),
    isUnreadable,
  };
}
function manifestStatement(change: ProjectionChange): SqlStatement {
  if (change.action === "remove") return removeManifest(change);
  const manifest = parseManifest(change.data);
  if (manifest === null || manifest.asset_id !== change.resource_id)
    throw new Error("Malformed map manifest change.");
  return upsertManifest(manifest, change);
}
function scopeInvalidation(
  body: Record<string, unknown>,
  hasTasks: boolean,
): readonly SqlStatement[] {
  return hasTasks || parseChanges(body.sampling_points).length || parseChanges(body.ovitraps).length
    ? [INVALIDATE_ATTACHMENTS]
    : [];
}
/** Only downloaded projections are owned here; no draft, event or attachment is ever replaced. */
export class DayStore {
  readonly #db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.#db = db;
  }
  async read(): Promise<DayCache> {
    const [tasks, manifests, meta] = await Promise.all([
      this.#db.query(LOCATED_ASSIGNMENTS),
      this.#db.query("SELECT payload FROM day_map_manifest WHERE removed=0"),
      this.#db.query("SELECT payload FROM day_bundle_meta WHERE slot=1"),
    ]);
    return {
      tasks: tasks.map((row) => ({
        task: JSON.parse(readText(row, "payload")) as AssignedTask,
        isKept: row.kept === 1,
        serverCompletion:
          row.server_completed === 1 ? true : row.server_completed === 0 ? false : null,
      })),
      manifests: manifests.map((row) => JSON.parse(readText(row, "payload")) as MapManifest),
      meta: meta[0] ? (JSON.parse(readText(meta[0], "payload")) as BundleMeta) : null,
    };
  }
  captureTransport(
    identity: EvidenceIdentity | null,
    isCurrent: () => boolean,
  ): Promise<CaptureTransportHandle | null> {
    return readCaptureTransport(this.#db, identity, isCurrent);
  }
  lifecycleSource(handle: CaptureTransportHandle, request: LifecycleSourceRequest | null) {
    return readLifecycleSource(this.#db, handle, request);
  }
  currentTask(id: string, expected: TaskOwner) {
    return readCurrentTask(this.#db, id, expected);
  }
  advanceCaptureTransport(
    handle: CaptureTransportHandle | null,
  ): Promise<CaptureTransportHandle | null> {
    return advanceCaptureTransport(this.#db, handle);
  }
  async replace(
    body: unknown,
    now: Date,
    handle: CaptureTransportHandle | null = null,
  ): Promise<void> {
    const bundle = parseBundle(body, now);
    const statements: SqlStatement[] = [
      ...captureContextCas(handle),
      INVALIDATE_ATTACHMENTS,
      removeMissingTasks(bundle.tasks.map((task) => task.id)),
      ...bundle.tasks.map((task) => upsertTask(task)),
      {
        sql: "UPDATE day_map_manifest SET removed=1 WHERE id NOT IN (SELECT value FROM json_each(?))",
        params: [JSON.stringify(bundle.manifests.map((manifest) => manifest.asset_id))],
      },
      ...bundle.manifests.map((manifest) => upsertManifest(manifest)),
      bundleMetadata(bundle.meta),
      ...courierBundleStatements(body),
      ...publishCaptureContext(body, handle, "bootstrap"),
      removeStatement(KV_KEYS.daySamplingPointsBootstrapPending),
      removeStatement(KV_KEYS.dayCompletionBootstrapPending),
      setStatement(KV_KEYS.syncCursor, bundle.cursor),
    ];
    await this.#db.runAtomically(statements);
  }
  async applyChanges(body: unknown, handle: CaptureTransportHandle | null = null): Promise<void> {
    if (!isRecord(body)) throw new Error("Malformed changes.");
    const tasks = parseChanges(body.assignments)
      .filter(
        (change) =>
          change.resource_type !== "quadrant_assignment" &&
          (change.resource_type === "task" || !isQuadrantAssignment(change.data)),
      )
      .map(assignmentStatement);
    const manifests = parseChanges(body.map_manifests).map(manifestStatement);
    const statements = [
      ...captureContextCas(handle),
      ...scopeInvalidation(body, tasks.length > 0),
      ...tasks.map((entry) => entry.statement),
      ...manifests,
      ...courierChangeStatements(body),
      ...publishCaptureContext(body, handle, "changes"),
    ];
    statements.push(...changeMetadata(body, tasks.filter((entry) => entry.isUnreadable).length));
    await this.#db.runAtomically(statements);
  }
  async markCleanupPending(): Promise<void> {
    await this.#db.runAtomically([
      setStatement("day_cleanup_pending", "true"),
      ...invalidateCaptureContext,
      revokeCaptureScope(),
    ]);
  }
  /** Preserve caches and authored facts while a known-invalid cursor requires a new full body. */
  async suspendCaptureForRecovery(handle: CaptureTransportHandle | null): Promise<void> {
    await this.#db.runAtomically([...captureRecoveryStatements(handle), INVALIDATE_ATTACHMENTS]);
  }
  /** Older parsers may have discarded fields even while their ETag/cursor remain valid. */
  async needsBootstrap(includeLifecycle = true): Promise<boolean> {
    const rows = await this.#db.query(
      `SELECT 1 FROM kv WHERE key IN (?,?,?) AND value='true'
        UNION ALL SELECT 1 WHERE ? AND NOT EXISTS(${CURRENT_CAPTURE_CONTEXT}) LIMIT 1`,
      [
        KV_KEYS.daySamplingPointsBootstrapPending,
        KV_KEYS.dayCompletionBootstrapPending,
        includeLifecycle ? LIFECYCLE_BOOTSTRAP_PENDING : KV_KEYS.dayCompletionBootstrapPending,
        includeLifecycle ? 1 : 0,
      ],
    );
    return rows.length > 0;
  }
  async needsCleanup(): Promise<boolean> {
    const rows = await this.#db.query("SELECT value FROM kv WHERE key='day_cleanup_pending'");
    return rows[0]?.value === "true";
  }
  async revoke(): Promise<void> {
    await this.#db.runAtomically([
      INVALIDATE_ATTACHMENTS,
      { sql: "DELETE FROM day_assignment" },
      { sql: "DELETE FROM day_map_manifest" },
      { sql: "DELETE FROM day_bundle_meta" },
      ...clearDownloadedProjections,
      ...invalidateCaptureContext,
      revokeCaptureScope(),
      { sql: "DELETE FROM day_sampling_point" },
      removeStatement("day_navigation"),
      removeStatement("shift_open_map"),
      removeStatement(KV_KEYS.syncCursor),
      removeStatement("day_cleanup_pending"),
    ]);
  }
}
function completeLifecycleBundle(body: unknown): boolean {
  return (
    isRecord(body) &&
    ["history", "quadrants", "sampling_points", "ovitraps"].every((key) => Array.isArray(body[key]))
  );
}
function bundleMetadata(meta: BundleMeta): SqlStatement {
  return {
    sql: "INSERT INTO day_bundle_meta(slot,payload) VALUES(1,?) ON CONFLICT(slot) DO UPDATE SET payload=excluded.payload",
    params: [JSON.stringify(meta)],
  };
}
function publishCaptureContext(
  body: unknown,
  handle: CaptureTransportHandle | null,
  source: "bootstrap" | "changes",
): readonly SqlStatement[] {
  const complete =
    source === "bootstrap"
      ? completeLifecycleBundle(body)
      : handle !== null && handle.scopeRevision !== null;
  return [
    ...contextPublication({ body, handle, source, complete }),
    ...retainedHistoryStatements(),
  ];
}
function changeMetadata(
  body: Record<string, unknown>,
  unreadable: number,
): readonly SqlStatement[] {
  const statements: SqlStatement[] = [
    {
      sql: "UPDATE day_bundle_meta SET payload=json_set(payload,'$.unreadable_rows',json_extract(payload,'$.unreadable_rows')+?)",
      params: [unreadable],
    },
  ];
  if (typeof body.next_change_at === "string" || body.next_change_at === null)
    statements.push({
      sql: "UPDATE day_bundle_meta SET payload=json_set(payload,'$.next_change_at',?)",
      params: [body.next_change_at],
    });
  return statements;
}
