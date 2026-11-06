import { readInteger, readText } from "./sql.ts";
import type { SqlExecutor, SqlRow } from "./sql.ts";
import { matchingSqlTokens, sqlTokens, UnsupportedSchemaDefinitionError } from "./schema-sql.ts";
import type { SchemaProfile } from "./schema-profile.ts";
import {
  requireSchemaMatch as requireMatch,
  UnsupportedDatabaseLineageError,
} from "./schema-error.ts";
import { checkSchemaMetadata } from "./schema-metadata.ts";
function isInternal(row: SqlRow, profile: SchemaProfile): boolean {
  const name = readText(row, "name");
  if (name === "sqlite_sequence") {
    return (
      row.type === "table" &&
      [...profile.tables.values()].some((table) => table.hasSequence) &&
      matchingSqlTokens({
        actual: sqlTokens(readText(row, "sql")),
        expected: sqlTokens("CREATE TABLE sqlite_sequence(name,seq)"),
        identifiers: new Set(),
      })
    );
  }
  const table = readText(row, "tbl_name");
  return (
    row.type === "index" &&
    row.sql === null &&
    profile.tables.has(table) &&
    new RegExp(`^sqlite_autoindex_${table}_[1-9][0-9]*$`).test(name)
  );
}
function checkObjects(rows: readonly SqlRow[], profile: SchemaProfile): void {
  const needsSequence = [...profile.tables.values()].some((table) => table.hasSequence);
  requireMatch(rows.some((row) => row.name === "sqlite_sequence") === needsSequence);
  const actual = rows.filter((row) => !isInternal(row, profile));
  requireMatch(actual.length === profile.objects.size);
  for (const row of actual) {
    const expected = profile.objects.get(readText(row, "name"));
    requireMatch(
      Boolean(expected && expected.type === row.type && expected.table === row.tbl_name),
    );
    requireMatch(
      matchingSqlTokens({
        actual: sqlTokens(readText(row, "sql")),
        expected: expected?.tokens ?? [],
        identifiers: profile.identifiers,
      }),
    );
  }
}

/** Reads metadata only. No pragma assignment, DDL, version/readiness write or repair. */
export async function inspectSchemaLineage(
  db: SqlExecutor,
  profiles: readonly SchemaProfile[],
): Promise<number> {
  const [row] = await db.query("PRAGMA user_version");
  const version = row === undefined ? -1 : readInteger(row, "user_version");
  const profile = profiles[version];
  requireMatch(Number.isInteger(version) && Boolean(profile));
  if (!profile) throw new UnsupportedDatabaseLineageError();
  const objects = await db.query(
    "SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name",
  );
  try {
    checkObjects(objects, profile);
  } catch (error) {
    if (error instanceof UnsupportedSchemaDefinitionError)
      throw new UnsupportedDatabaseLineageError();
    throw error;
  }
  await checkSchemaMetadata(db, profile);
  return version;
}
