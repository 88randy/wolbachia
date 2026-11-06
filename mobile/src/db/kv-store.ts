import type { SqlExecutor, SqlStatement } from "./sql.ts";
import { readText } from "./sql.ts";

/** Keys of the `kv` table. One place, so no key is spelled twice. */
export const KV_KEYS = {
  deviceId: "device_id",
  syncCursor: "sync_cursor",
  daySamplingPointsBootstrapPending: "day_sampling_points_bootstrap_pending",
  dayCompletionBootstrapPending: "day_completion_bootstrap_pending",
  catalogVersion: "catalog_version",
  rulesVersion: "rules_version",
  lastSyncAt: "last_sync_at",
  apiBaseUrlOverride: "api_base_url_override",
  themePreference: "theme_preference",
  locale: "locale",
} as const;

/** Small key-value settings kept in the same SQLite file as the outbox. */
export class KvStore {
  readonly #db: SqlExecutor;

  constructor(db: SqlExecutor) {
    this.#db = db;
  }

  async get(key: string): Promise<string | null> {
    const rows = await this.#db.query("SELECT value FROM kv WHERE key = ?", [key]);
    const [row] = rows;
    return row === undefined ? null : readText(row, "value");
  }

  async set(key: string, value: string): Promise<void> {
    await this.#db.runAtomically([setStatement(key, value)]);
  }

  /** Compare-and-set prevents late native results from restoring a newer/removed selection. */
  async compareAndSet(entry: {
    readonly key: string;
    readonly expected: string;
    readonly value: string;
  }): Promise<void> {
    await this.#db.runAtomically([
      {
        sql: "UPDATE kv SET value=? WHERE key=? AND value=?",
        params: [entry.value, entry.key, entry.expected],
      },
    ]);
  }

  async remove(key: string): Promise<void> {
    await this.#db.runAtomically([removeStatement(key)]);
  }
}

/** The statement that stores a value; used to batch settings with other writes atomically. */
export function setStatement(key: string, value: string): SqlStatement {
  return {
    sql: "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    params: [key, value],
  };
}

export function removeStatement(key: string): SqlStatement {
  return { sql: "DELETE FROM kv WHERE key = ?", params: [key] };
}
