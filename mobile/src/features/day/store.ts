import { VISIBLE_ASSIGNMENTS } from "./pending-work.ts";
import { setStatement, removeStatement, KV_KEYS } from "../../db/kv-store.ts";
import { readText } from "../../db/sql.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { isRecord, parseAssignment, parseManifest, parseChanges } from "./assignment-parser.ts";
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
      this.#db.query(VISIBLE_ASSIGNMENTS),
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
      setStatement(KV_KEYS.syncCursor, bundle.cursor),
    ];
    await this.#db.runAtomically(statements);
  }
  async applyChanges(body: unknown): Promise<void> {
    if (!isRecord(body)) throw new Error("Malformed changes.");
    const tasks = parseChanges(body.assignments).map(assignmentStatement);
    const manifests = parseChanges(body.map_manifests).map(manifestStatement);
    const statements = [...tasks, ...manifests].filter(
      (entry): entry is SqlStatement => entry !== null,
    );
    const unreadable = tasks.length + manifests.length - statements.length;
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
  async revoke(): Promise<void> {
    await this.#db.runAtomically([
      { sql: "DELETE FROM day_assignment" },
      { sql: "DELETE FROM day_map_manifest" },
      { sql: "DELETE FROM day_bundle_meta" },
      removeStatement("day_navigation"),
      removeStatement("shift_open_map"),
      removeStatement(KV_KEYS.syncCursor),
    ]);
  }
}
