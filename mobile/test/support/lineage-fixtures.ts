import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { TestContext } from "node:test";
import type { SqlExecutor, SqlRow } from "../../src/db/sql.ts";

interface HistoricalFamily {
  ref: string;
  versions: number[];
  canonicalPrefix: number;
  suffixes: string[];
  sha256: string;
}
interface History {
  canonicalSha256: string;
  commonPrefix: string[][];
  families: HistoricalFamily[];
  suffixes: Record<string, string[]>;
}
interface FixtureSetup {
  migrations: readonly (readonly string[])[];
  version: number;
}
export const HISTORY = JSON.parse(
  readFileSync(new URL("./schema-lineage-history.json", import.meta.url), "utf8"),
) as History;
export function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function historicalSuffix(hash: string): readonly string[] {
  const statements = HISTORY.suffixes[hash];
  assert.ok(statements, "Pinned suffix is missing");
  return statements;
}
export function historicalCases() {
  return HISTORY.families.flatMap((family) => {
    const migrations = [
      ...HISTORY.commonPrefix.slice(0, family.canonicalPrefix),
      ...family.suffixes.map(historicalSuffix),
    ];
    assert.equal(digest(migrations), family.sha256, "Pinned historical DDL changed");
    return family.versions.map((version) => ({
      label: `${family.ref.slice(0, 7)} schema${String(version)}`,
      migrations,
      version,
    }));
  });
}

function applyPrefix(
  database: DatabaseSync,
  setup: { migrations: readonly (readonly string[])[]; version: number },
) {
  for (const [index, statements] of setup.migrations.entries()) {
    if (index >= setup.version) break;
    database.exec("BEGIN");
    for (const sql of statements) database.exec(sql);
    database.exec(`PRAGMA user_version=${String(index + 1)}`);
    database.exec("COMMIT");
  }
}
function seedRetained(database: DatabaseSync): void {
  if (!database.prepare("SELECT 1 FROM sqlite_master WHERE name='kv'").get()) return;
  database
    .prepare("INSERT INTO kv(key,value) VALUES(?,?)")
    .run("audit_marker", "own-synthetic-only");
  database
    .prepare(
      `INSERT INTO outbox_event
    (id,type,schema_version,device_time,payload,rules_version,catalog_version,updated_at)
    VALUES(?,?,?,?,?,?,?,?)`,
    )
    .run(
      "11111111-1111-4111-8111-111111111111",
      "audit.synthetic",
      1,
      "2026-11-06T00:00:00.000Z",
      '{"retained":"exact-envelope"}',
      "rules-test",
      "catalog-test",
      "2026-11-06T00:00:00.000Z",
    );
}
export function sqliteExecutor(
  database: DatabaseSync,
  writes: string[],
  trace: string[] = [],
): SqlExecutor {
  return {
    query: (sql, params = []) => {
      trace.push(sql);
      if (/^PRAGMA\s+(?:journal_mode|synchronous)\s*=/i.test(sql)) writes.push(sql);
      return Promise.resolve(database.prepare(sql).all(...params) as SqlRow[]);
    },
    runAtomically: (statements) => {
      trace.push("migration batch");
      writes.push(...statements.map((statement) => statement.sql));
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
}
async function snapshotDatabase(input: {
  database: DatabaseSync;
  path: string;
  hasSource: boolean;
}) {
  const { database, path, hasSource } = input;
  return {
    hash: createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
    version: database.prepare("PRAGMA user_version").get(),
    schema: database
      .prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name")
      .all(),
    envelope: hasSource ? database.prepare("SELECT * FROM outbox_event").all() : [],
    marker: hasSource
      ? database.prepare("SELECT value FROM kv WHERE key='audit_marker'").get()
      : null,
  };
}
export async function createLineageFixture(test: TestContext, setup: FixtureSetup) {
  const root = await mkdtemp(join(tmpdir(), "wolbachia-lineage-266-"));
  const path = join(root, "fixture.sqlite");
  let database = new DatabaseSync(path);
  applyPrefix(database, setup);
  seedRetained(database);
  database.close();
  database = new DatabaseSync(path);
  const writes: string[] = [];
  const trace: string[] = [];
  test.after(async () => {
    database.close();
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + "wolbachia-lineage-266-"));
    await rm(root, { recursive: true });
  });
  return {
    get database() {
      return database;
    },
    writes,
    trace,
    executor: sqliteExecutor(database, writes, trace),
    snapshot: () => snapshotDatabase({ database, path, hasSource: setup.version > 0 }),
    reopen: () => {
      database.close();
      database = new DatabaseSync(path);
      return sqliteExecutor(database, writes, trace);
    },
  };
}
