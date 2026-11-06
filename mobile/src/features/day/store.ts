import { LOCATED_ASSIGNMENTS } from "./task-locations.ts";
import { INVALIDATE_ATTACHMENTS } from "../../attachments/schema.ts";
import { samplingPointChange, replaceSamplingPoints } from "./sampling-point-statements.ts";
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
function assignmentStatement(change: ProjectionChange): SqlStatement | null {
  if (change.action === "remove") return removeTask(change);
  const task = parseAssignment(change.data);
  return task === null || task.id !== change.resource_id ? null : upsertTask(task, change);
}
function manifestStatement(change: ProjectionChange): SqlStatement {
  if (change.action === "remove") return removeManifest(change);
  const manifest = parseManifest(change.data);
  if (manifest === null || manifest.asset_id !== change.resource_id)
    throw new Error("Malformed map manifest change.");
  return upsertManifest(manifest, change);
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
      })),
      manifests: manifests.map((row) => JSON.parse(readText(row, "payload")) as MapManifest),
      meta: meta[0] ? (JSON.parse(readText(meta[0], "payload")) as BundleMeta) : null,
    };
  }
  async replace(body: unknown, now: Date): Promise<void> {
    const bundle = parseBundle(body, now);
    const statements: SqlStatement[] = [
      INVALIDATE_ATTACHMENTS,
      removeMissingTasks(bundle.tasks.map((task) => task.id)),
      ...bundle.tasks.map((task) => upsertTask(task)),
      {
        sql: "UPDATE day_map_manifest SET removed=1 WHERE id NOT IN (SELECT value FROM json_each(?))",
        params: [JSON.stringify(bundle.manifests.map((manifest) => manifest.asset_id))],
      },
      ...bundle.manifests.map((manifest) => upsertManifest(manifest)),
      {
        sql: "INSERT INTO day_bundle_meta(slot,payload) VALUES(1,?) ON CONFLICT(slot) DO UPDATE SET payload=excluded.payload",
        params: [JSON.stringify(bundle.meta)],
      },
      ...replaceSamplingPoints(bundle.samplingPoints),
      removeStatement(KV_KEYS.daySamplingPointsBootstrapPending),
      setStatement(KV_KEYS.syncCursor, bundle.cursor),
    ];
    await this.#db.runAtomically(statements);
  }
  async applyChanges(body: unknown): Promise<void> {
    if (!isRecord(body)) throw new Error("Malformed changes.");
    const tasks = parseChanges(body.assignments)
      .filter(
        (change) =>
          change.resource_type !== "quadrant_assignment" && !isQuadrantAssignment(change.data),
      )
      .map(assignmentStatement);
    const manifests = parseChanges(body.map_manifests).map(manifestStatement);
    const points = parseChanges(body.sampling_points).map(samplingPointChange);
    const statements = [...tasks, ...manifests, ...points].filter(
      (entry): entry is SqlStatement => entry !== null,
    );
    if (tasks.length || points.length) statements.unshift(INVALIDATE_ATTACHMENTS);
    const unreadable = tasks.filter((entry) => entry === null).length;
    statements.push({
      sql: "UPDATE day_bundle_meta SET payload=json_set(payload,'$.unreadable_rows',json_extract(payload,'$.unreadable_rows')+?)",
      params: [unreadable],
    });
    if (typeof body.next_change_at === "string" || body.next_change_at === null)
      statements.push({
        sql: "UPDATE day_bundle_meta SET payload=json_set(payload,'$.next_change_at',?)",
        params: [body.next_change_at],
      });
    await this.#db.runAtomically(statements);
  }
  async markCleanupPending(): Promise<void> {
    await this.#db.runAtomically([setStatement("day_cleanup_pending", "true")]);
  }
  /** An upgraded cache needs a complete point section even when its ETag/cursor remain valid. */
  async needsSamplingPointBootstrap(): Promise<boolean> {
    const rows = await this.#db.query("SELECT value FROM kv WHERE key=?", [
      KV_KEYS.daySamplingPointsBootstrapPending,
    ]);
    return rows[0]?.value === "true";
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
      { sql: "DELETE FROM day_sampling_point" },
      removeStatement("day_navigation"),
      removeStatement("shift_open_map"),
      removeStatement(KV_KEYS.syncCursor),
      removeStatement("day_cleanup_pending"),
    ]);
  }
}
