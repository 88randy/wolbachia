import { DatabaseSync } from "node:sqlite";

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
export async function openTestDatabase(path: string) {
  const database = new DatabaseSync(path);
  const executor = databaseExecutor(database);
  await migrate(executor);
  return {
    executor,
    close: () => {
      database.close();
    },
  };
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
