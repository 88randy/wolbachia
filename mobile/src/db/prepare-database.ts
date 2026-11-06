import { assertCanonicalDatabaseLineage, migrate } from "./migrations.ts";
import type { SqlExecutor } from "./sql.ts";

// Only after a supported lineage: WAL avoids reader/writer waits; FULL retains durable commits.
const DURABILITY_PRAGMAS = ["PRAGMA journal_mode = WAL", "PRAGMA synchronous = FULL"] as const;

/** Runs OUR configuration/migrations only after the read-only structural preflight. */
export async function prepareDatabase(db: SqlExecutor): Promise<void> {
  await assertCanonicalDatabaseLineage(db);
  for (const pragma of DURABILITY_PRAGMAS) await db.query(pragma);
  await migrate(db);
}
