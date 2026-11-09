import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate, CANONICAL_MIGRATIONS, SCHEMA_VERSION } from "../src/db/migrations.ts";
import { prepareDatabase } from "../src/db/prepare-database.ts";
import {
  createLineageFixture,
  digest,
  HISTORY,
  historicalCases,
} from "./support/lineage-fixtures.ts";
import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import { PROJECTION_IDENTITY } from "./support/lifecycle-projection-fixtures.ts";

void test("all seven pinned unmerged lineages refuse before any migration write and survive reopen", async (test) => {
  for (const setup of historicalCases()) {
    await test.test(setup.label, async (scenario) => {
      const fixture = await createLineageFixture(scenario, setup);
      const before = await fixture.snapshot();
      await assert.rejects(migrate(fixture.executor), { name: "UnsupportedDatabaseLineageError" });
      assert.deepEqual(fixture.writes, []);
      assert.deepEqual(await fixture.snapshot(), before);
      await assert.rejects(migrate(fixture.reopen()), { name: "UnsupportedDatabaseLineageError" });
      assert.deepEqual(await fixture.snapshot(), before);
      assert.deepEqual(fixture.writes, []);
    });
  }
});

void test("every released canonical prefix and cleared readiness state keeps its real migration/data path", async (test) => {
  assert.equal(digest(CANONICAL_MIGRATIONS.slice(0, 11)), HISTORY.canonicalSha256);
  const original = HISTORY.families.find((family) => family.canonicalPrefix === 9);
  assert.ok(original);
  assert.deepEqual(
    CANONICAL_MIGRATIONS.slice(11, 14).map((statements) => digest(statements)),
    original.suffixes,
  );
  for (let version = 0; version <= SCHEMA_VERSION; version++) {
    await test.test(`canonical${String(version)}`, async (scenario) => {
      const fixture = await createLineageFixture(scenario, {
        migrations: CANONICAL_MIGRATIONS,
        version,
      });
      if (version > 0)
        fixture.database.exec(
          "DELETE FROM kv WHERE key IN ('day_sampling_points_bootstrap_pending','day_completion_bootstrap_pending')",
        );
      const before = await fixture.snapshot();
      await migrate(fixture.executor);
      assert.equal(
        fixture.database.prepare("PRAGMA user_version").get()?.user_version,
        SCHEMA_VERSION,
      );
      const after = await fixture.snapshot();
      assert.equal(after.envelope.length, before.envelope.length);
      for (const [key, value] of Object.entries(before.envelope[0] ?? {}))
        assert.deepEqual(after.envelope[0]?.[key], value);
      assert.deepEqual(after.marker, before.marker);
      await migrate(fixture.reopen());
      assert.deepEqual(await fixture.snapshot(), after);
    });
  }
  await legacyLifecycleReservation(test);
});

async function legacyLifecycleReservation(test: import("node:test").TestContext) {
  const fixture = await createLineageFixture(test, {
    migrations: CANONICAL_MIGRATIONS.slice(0, 15),
    version: 15,
  });
  const [source] = await fixture.executor.query("SELECT id FROM outbox_event LIMIT 1");
  assert.ok(source);
  const legacyId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await fixture.executor.runAtomically([
    {
      sql: "INSERT INTO lifecycle_evidence(event_id,evidence_id,file_ref) VALUES(?,?,?)",
      params: [String(source.id), legacyId.toUpperCase(), "synthetic-legacy-unowned"],
    },
  ]);
  const store = new AttachmentStore(fixture.executor),
    fence = await store.bindSession(PROJECTION_IDENTITY);
  assert.ok(fence);
  const references = await fixture.executor.query("SELECT * FROM lifecycle_evidence");
  await assert.rejects(
    store.reserve({ id: legacyId, draftId: "fresh-draft", fence }),
    /stale_context|unproven lifecycle/,
  );
  await migrate(fixture.executor);
  await assert.rejects(
    async () =>
      fixture.executor.query("INSERT INTO attachment_file(id,owner_key,draft_id) VALUES(?,?,?)", [
        legacyId.toUpperCase(),
        fence.ownerKey,
        "fresh-draft",
      ]),
    /unproven lifecycle/,
  );
  assert.deepEqual(await fixture.executor.query("SELECT * FROM lifecycle_evidence"), references);
  assert.deepEqual(await fixture.executor.query("SELECT * FROM attachment_file"), []);
  const fresh = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  await store.reserve({ id: fresh, draftId: String(source.id), fence });
  await store.saveOwned(
    {
      id: fresh,
      fileRef: "synthetic-owned",
      sizeBytes: 4,
      contentType: "image/png",
      sha256: "a".repeat(64),
    },
    fence,
  );
  await fixture.executor.runAtomically(
    store.bindingStatements({ eventId: String(source.id), evidenceIds: [fresh], fence }),
  );
  await store.saveProgress({
    id: fresh,
    fence,
    state: "verified",
    verifiedAt: "2026-11-07T00:00:00Z",
    attemptVersion: 0,
  });
  await fixture.executor.runAtomically([
    {
      sql: "INSERT INTO lifecycle_evidence(event_id,evidence_id,file_ref) VALUES(?,?,?)",
      params: [String(source.id), fresh, "synthetic-owned"],
    },
  ]);
  const owned = await fixture.executor.query("SELECT * FROM attachment_file"),
    bindings = await fixture.executor.query("SELECT * FROM attachment_event");
  await fixture.executor.query(
    "INSERT OR IGNORE INTO attachment_file(id,owner_key,draft_id) VALUES(?,?,?)",
    [fresh, fence.ownerKey, String(source.id)],
  );
  assert.deepEqual(await fixture.executor.query("SELECT * FROM attachment_file"), owned);
  assert.deepEqual(await fixture.executor.query("SELECT * FROM attachment_event"), bindings);
  await assert.rejects(
    async () =>
      fixture.executor.query(
        "INSERT OR IGNORE INTO attachment_file(id,owner_key,draft_id) VALUES(?,?,?)",
        [fresh.toUpperCase(), "another-owner", "fresh-draft"],
      ),
    /unproven lifecycle/,
  );
  assert.deepEqual(await fixture.executor.query("SELECT * FROM attachment_file"), owned);
  const reopened = fixture.reopen();
  await migrate(reopened);
  assert.deepEqual(await reopened.query("SELECT * FROM attachment_file"), owned);
}

void test("the real startup orchestrator refuses before OUR settings and configures supported storage only afterward", async (test) => {
  const setup = historicalCases().find((candidate) => candidate.label === "33e6b78 schema10");
  assert.ok(setup);
  const rejected = await createLineageFixture(test, setup);
  const before = await rejected.snapshot();
  await assert.rejects(prepareDatabase(rejected.executor), {
    name: "UnsupportedDatabaseLineageError",
  });
  assert.deepEqual(rejected.writes, []);
  assert.deepEqual(await rejected.snapshot(), before);
  const supported = await createLineageFixture(test, {
    migrations: CANONICAL_MIGRATIONS,
    version: 9,
  });
  await prepareDatabase(supported.executor);
  assert.deepEqual(supported.writes.slice(0, 2), [
    "PRAGMA journal_mode = WAL",
    "PRAGMA synchronous = FULL",
  ]);
  const firstWrite = supported.trace.indexOf("PRAGMA journal_mode = WAL");
  assert.ok(
    firstWrite > supported.trace.findIndex((sql) => sql.includes("pragma_foreign_key_list")),
  );
  assert.ok(firstWrite < supported.trace.indexOf("migration batch"));
  assert.equal(
    supported.database.prepare("PRAGMA user_version").get()?.user_version,
    SCHEMA_VERSION,
  );
});

void test("future, nonempty-zero, partial/mixed and changed literal/constraints fail closed without mutation", async (test) => {
  const identityView = CANONICAL_MIGRATIONS[13]?.find((sql) =>
    sql.startsWith("CREATE VIEW lifecycle_identity_effect"),
  );
  assert.ok(identityView);
  const cases = [
    { name: "canonical11 falsely stamped12", version: 11, sql: "PRAGMA user_version=12" },
    {
      name: `future${String(SCHEMA_VERSION + 1)}`,
      version: SCHEMA_VERSION,
      sql: `PRAGMA user_version=${String(SCHEMA_VERSION + 1)}`,
    },
    { name: "nonempty0", version: 0, sql: "CREATE TABLE foreign_fixture(id TEXT)" },
    { name: "partial attachments", version: 11, sql: "DROP TABLE attachment_context" },
    {
      name: "mixed lifecycle",
      version: 11,
      sql: "CREATE TABLE lifecycle_capture(foreign_id TEXT)",
    },
    {
      name: "unknown index",
      version: 11,
      sql: "CREATE UNIQUE INDEX unexpected_unique ON kv(key,value)",
    },
    { name: "unknown view", version: 11, sql: "CREATE VIEW vendor_view AS SELECT 1 AS marker" },
    { name: "missing retention trigger", version: 11, sql: "DROP TRIGGER outbox_event_no_delete" },
    { name: "missing known view", version: 14, sql: "DROP VIEW lifecycle_active_identity" },
    {
      name: "view replaced by table",
      version: 14,
      sql: "DROP VIEW lifecycle_active_identity; CREATE TABLE lifecycle_active_identity(id TEXT)",
    },
    {
      name: "changed view literal",
      version: 14,
      sql:
        "DROP VIEW lifecycle_identity_effect; " +
        identityView.replace("1 AS is_retired", "0 AS is_retired"),
    },
  ];
  for (const candidate of cases) {
    await test.test(candidate.name, async (scenario) => {
      const fixture = await createLineageFixture(scenario, {
        migrations: CANONICAL_MIGRATIONS,
        version: candidate.version,
      });
      fixture.database.exec(candidate.sql);
      const before = await fixture.snapshot();
      await assert.rejects(prepareDatabase(fixture.executor), {
        name: "UnsupportedDatabaseLineageError",
      });
      assert.deepEqual(fixture.writes, []);
      assert.deepEqual(await fixture.snapshot(), before);
    });
  }
});

void test("known identifier quoting folds portably while SQL string literals and constraints never fold", async (test) => {
  const quoted = CANONICAL_MIGRATIONS.map((migration) =>
    migration.map((sql) =>
      sql
        .replace("CREATE TABLE kv", 'create table "kv"')
        .replace("key TEXT PRIMARY KEY", '"key" TEXT PRIMARY KEY'),
    ),
  );
  const supported = await createLineageFixture(test, {
    migrations: quoted,
    version: SCHEMA_VERSION,
  });
  await migrate(supported.executor);
  assert.deepEqual(supported.writes, []);
  const changes = [
    ["'error'", "'Error'"],
    ["'[]'", "'[ ]'"],
    [" DEFERRABLE INITIALLY DEFERRED", ""],
  ] as const;
  for (const [original, replacement] of changes) {
    const changed = CANONICAL_MIGRATIONS.map((migration) =>
      migration.map((sql) => sql.replace(original, replacement)),
    );
    const rejected = await createLineageFixture(test, { migrations: changed, version: 11 });
    const before = await rejected.snapshot();
    await assert.rejects(migrate(rejected.executor), { name: "UnsupportedDatabaseLineageError" });
    assert.deepEqual(rejected.writes, []);
    assert.deepEqual(await rejected.snapshot(), before);
  }
});
