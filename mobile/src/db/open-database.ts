import { open } from "@op-engineering/op-sqlite";
import type { DB, SQLBatchTuple } from "@op-engineering/op-sqlite";

import { getRandomBytes } from "expo-crypto";

import { nativeSecrets } from "../auth/native-secrets.ts";
import { openEncryptedDatabase } from "./encrypted-database.ts";
import { prepareDatabase } from "./prepare-database.ts";
import type { SqlExecutor, SqlRow, SqlStatement, SqlValue } from "./sql.ts";

function toTuple(statement: SqlStatement): SQLBatchTuple {
  // A tuple without parameters is `[sql]`: with `[sql, []]` the library cannot tell one empty
  // parameter set from "no parameter sets".
  const { sql, params } = statement;
  return params === undefined || params.length === 0 ? [sql] : [sql, [...params]];
}

class OpSqliteExecutor implements SqlExecutor {
  readonly #db: DB;

  constructor(db: DB) {
    this.#db = db;
  }

  async query(sql: string, params: readonly SqlValue[] = []): Promise<readonly SqlRow[]> {
    const result = await this.#db.execute(sql, [...params]);
    return result.rows;
  }

  async runAtomically(statements: readonly SqlStatement[]): Promise<void> {
    if (statements.length === 0) return;
    await this.#db.executeBatch(statements.map(toTuple));
  }
}

/** Opens the app database, applies the durability settings and the migrations. */
export async function openDatabase(): Promise<SqlExecutor> {
  const executor = await openEncryptedDatabase({
    secrets: nativeSecrets,
    randomBytes: getRandomBytes,
    open: (options) => new OpSqliteExecutor(open(options)),
  });
  await prepareDatabase(executor);
  return executor;
}
