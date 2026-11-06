import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";

import { migrate } from "../../src/db/migrations.ts";
import type { SqlExecutor, SqlRow, SqlValue } from "../../src/db/sql.ts";

/**
 * Node's built-in SQLite behind the app's `SqlExecutor`, so the outbox SQL runs in unit tests
 * exactly as written (the phone uses op-sqlite, which is SQLite too).
 */
export async function createTestDatabase(): Promise<SqlExecutor> {
  return (await openTestDatabase(":memory:")).executor;
}
/** A closable adapter for file-backed durability tests; ordinary tests remain in memory. */
export async function openTestDatabase(path: string, throughSchema?: number) {
  const database = new DatabaseSync(path);
  const executor = databaseExecutor(database);
  if (throughSchema === undefined) await migrate(executor);
  else await migrateThrough(executor, throughSchema);
  return {
    executor,
    close: () => {
      database.close();
    },
  };
}
/** Build a real historical prefix without cloning migration SQL or pretending it is the latest schema. */
export async function migrateThrough(db: SqlExecutor, version: number): Promise<void> {
  await assert.rejects(
    migrate({
      ...db,
      runAtomically: (statements) => {
        if (statements.some(({ sql }) => sql === `PRAGMA user_version = ${String(version + 1)}`))
          return Promise.reject(new Error("Upgrade paused before the next migration"));
        return db.runAtomically(statements);
      },
    }),
    /Upgrade paused before the next migration/,
  );
}
export function databaseExecutor(database: DatabaseSync): SqlExecutor {
  const executor: SqlExecutor = {
    query(sql: string, params: readonly SqlValue[] = []) {
      const rows = database.prepare(sql).all(...params) as SqlRow[];
      return Promise.resolve(rows);
    },
    runAtomically(statements) {
      database.exec("BEGIN");
      try {
        for (const { sql, params = [] } of statements) database.prepare(sql).run(...params);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
      return Promise.resolve();
    },
  };
  return executor;
}
