import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { AuthController } from "../src/auth/auth-controller.ts";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { createStores, FIXED_NOW, makeEnvelope } from "./support/factories.ts";
import { makeCredentials, deferred } from "./support/auth-fakes.ts";

async function cleanupFixture() {
  const stores = await createStores();
  const { credentials } = await makeCredentials();
  await credentials.update((current) => ({ ...current, passwordAttempts: 4 }));
  await stores.kv.set(
    "session_profile",
    JSON.stringify({
      username: "courier-test",
      firstName: "Test",
      organization: null,
      permissions: [],
    }),
  );
  const store = new DayStore(stores.db);
  await store.replace(
    {
      bundle_version: "bundle-1",
      schema_version: "schema-1",
      scope_revision: "scope-1",
      next_change_at: null,
      cursor: "cleanup-cursor",
      map_manifest_ready: false,
      map_manifests: [],
      assignments: [
        {
          kind: "task",
          id: "task-1",
          code: "OV-1",
          point: "point-1",
          quadrant_id: "quadrant-1",
          courier: "courier-test",
          category: null,
          revision: 1,
          action: "check",
          date: "2026-01-15",
        },
      ],
    },
    FIXED_NOW,
  );
  const bundle = new DayBundleService({
    store,
    now: () => FIXED_NOW,
    transport: () => Promise.reject(new Error("Cleanup must not wait for network")),
  });
  let logins = 0;
  const enrolled = credentials.getSnapshot();
  const deps = {
    ...stores,
    credentials,
    clearSessionData: bundle.clearForAuth,
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    hasLocalRecords: () => Promise.resolve(true),
    login: () => {
      logins += 1;
      return Promise.reject(new Error("Cleanup must never replay login"));
    },
    fetchRules: () => Promise.resolve(null),
    verify: () => Promise.resolve(false),
  };
  const createAuth = () => new AuthController(deps);
  const auth = createAuth();
  await auth.load();
  const evidence = makeEnvelope();
  await stores.outbox.enqueue(evidence);
  return {
    ...stores,
    credentials,
    enrolled,
    createAuth,
    store,
    bundle,
    auth,
    evidence,
    logins: () => logins,
  };
}
async function failCleanup(h: Awaited<ReturnType<typeof cleanupFixture>>) {
  await h.db.query(
    "CREATE TRIGGER fail_cleanup BEFORE DELETE ON day_assignment BEGIN SELECT RAISE(ABORT,'storage unavailable'); END",
  );
  await assert.rejects(
    h.auth.unlock("pw-for-wrong-local-password", "password"),
    /storage unavailable/,
  );
  assert.equal(h.auth.canLogin(), false);
  assert.equal(h.credentials.getSnapshot().pair, null);
  assert.equal((await h.bundle.read()).tasks.length, 0);
  assert.equal((await h.db.query("SELECT id FROM day_assignment")).length, 1);
}
void test("session cleanup: boot retry after a failed clear releases login only after actual success", async () => {
  const h = await cleanupFixture();
  await failCleanup(h);
  const restarted = h.createAuth();
  await restarted.load(); // Failed boot cleanup stays usable on P1 with Retry, while fenced.
  assert.equal(restarted.canLogin(), false);
  assert.equal(restarted.getSnapshot().notice?.key, "mobile.login.cleanupFailed");
  await h.db.query("DROP TRIGGER fail_cleanup");
  await h.auth.load();
  assert.equal((await h.db.query("SELECT id FROM day_assignment")).length, 0);
  assert.equal(h.auth.canLogin(), true);
  assert.equal((await h.outbox.claimPending(10))[0]?.envelope.id, h.evidence.id);
  assert.equal(h.logins(), 0);
});

import { SyncEngine } from "../src/sync/sync-engine.ts";
import { FIXED_DEVICE_ID } from "./support/factories.ts";
import {
  loginNotice,
  authNoticePresentation,
} from "../src/screens/auth/auth-notice-presentation.ts";
void test("session cleanup: offline sync retries failures before session/server gates and joins boot/manual retry without replay", async () => {
  const h = await cleanupFixture();
  await failCleanup(h);
  const reports: unknown[] = [];
  const engine = new SyncEngine({
    beforeSync: h.auth.retrySessionDataCleanup,
    pass: {
      ...h,
      ...h.bundle.syncHooks(),
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: () => Promise.reject(new Error("No HTTP without session or server")),
    },
    hasSession: h.credentials.hasSyncSession,
    hasServer: () => false,
    hasPendingFinalUpload: h.credentials.hasPendingFinalUpload,
    random: () => 0,
    schedule: () => () => undefined,
    report: (error) => {
      reports.push(error);
    },
  });
  await engine.requestSync();
  assert.equal(engine.getSnapshot().phase, "waitingRetry");
  assert.equal(reports.length, 1);
  assert.equal(h.auth.canLogin(), false);
  const notice = loginNotice(h.auth.getSnapshot(), { key: "mobile.storage.actionFailed" });
  assert.equal(notice?.key, "mobile.login.cleanupFailed");
  assert.equal(authNoticePresentation("mobile.login.cleanupFailed").tone, "critical");
  await h.db.query("DROP TRIGGER fail_cleanup");
  const entered = deferred<undefined>();
  const release = deferred<undefined>();
  const clear = h.bundle.clearSessionData;
  let clears = 0;
  h.bundle.clearSessionData = async () => {
    clears += 1;
    entered.resolve(undefined);
    await release.promise;
    await clear();
  };
  const running = engine.requestSync();
  await Promise.race([
    entered.promise,
    running.then(() => {
      throw new Error("Sync ended before cleanup retry");
    }),
  ]);
  const manual = h.auth.retrySessionDataCleanup();
  const boot = h.auth.load();
  await h.credentials.whenSettled();
  await h.auth.login("courier-test", "pw-for-pending-cleanup");
  assert.equal(clears, 1);
  assert.equal(h.auth.canLogin(), false);
  assert.equal((await h.bundle.read()).tasks.length, 0);
  assert.equal((await h.db.query("SELECT id FROM day_assignment")).length, 1);
  assert.equal(h.logins(), 0);
  release.resolve(undefined);
  await Promise.all([running, manual, boot]);
  assert.equal(clears, 1);
  assert.equal(h.auth.canLogin(), true);
  assert.equal((await h.db.query("SELECT id FROM day_assignment")).length, 0);
  assert.equal((await h.outbox.countByStatus()).pending, 1);
  assert.equal(h.logins(), 0);
});

void test("session cleanup: an old successful clear cannot release a replacement session's data fence", async () => {
  const h = await cleanupFixture();
  await failCleanup(h);
  await h.db.query("DROP TRIGGER fail_cleanup");
  const entered = deferred<undefined>();
  const release = deferred<undefined>();
  const clear = h.bundle.clearSessionData;
  let clears = 0;
  h.bundle.clearSessionData = async () => {
    clears += 1;
    entered.resolve(undefined);
    await release.promise;
    await clear();
  };
  const pending = h.auth.retrySessionDataCleanup();
  await entered.promise;
  await h.credentials.update(() => ({
    ...h.enrolled,
    sessionId: randomUUID(),
    pair: { access: randomUUID(), refresh: randomUUID() },
  }));
  await h.credentials.runExclusive((transaction) => {
    transaction.grantUnlock(h.credentials.unlockGate());
  });
  assert.equal(h.credentials.isUnlocked(), true);
  assert.equal(h.auth.getSnapshot().phase, "locked");
  assert.equal(h.auth.canUseBiometrics(), false);
  release.resolve(undefined);
  await assert.rejects(pending, /Session changed during local data cleanup/);
  assert.equal(h.auth.getSnapshot().phase, "locked");
  await h.auth.retrySessionDataCleanup();
  assert.equal(clears, 2);
  assert.equal(h.auth.getSnapshot().phase, "unlocked");
  assert.equal((await h.outbox.countByStatus()).pending, 1);
  assert.equal(h.logins(), 0);
});
