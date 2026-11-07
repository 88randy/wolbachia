import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createApiClient } from "@wolbachia/api-client";
import type { SessionRequests } from "../src/auth/session-requests.ts";
import { SessionRequests as ActualSessionRequests } from "../src/auth/session-requests.ts";
import { PrivateAttachmentTransport } from "../src/attachments/attachment-transport.ts";
import { FixtureEvidenceCapture as EvidenceCapture } from "./support/capture-fixture.ts";
import { AttachmentSync } from "../src/attachments/attachment-sync.ts";
import { attachmentSyncHooks } from "../src/attachments/sync-hooks.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import {
  attachmentHarness,
  EVIDENCE_ID,
  PNG_BYTES,
  NOW,
  OWNER,
} from "./support/attachment-fixtures.ts";
import { makeEnvelope } from "./support/factories.ts";
import { accepted, answer } from "./support/scripted-transport.ts";
import { deferred, loginResponse, memorySecrets } from "./support/auth-fakes.ts";
import { DayStore } from "../src/features/day/store.ts";
import { acceptedEvidenceOwner } from "../src/attachments/accepted-owner.ts";
import { CredentialStore, EMPTY_CREDENTIALS } from "../src/auth/credential-store.ts";

const requests: Pick<SessionRequests, "run"> = { run: (call) => call() };
const grant = () => ({
  upload_id: EVIDENCE_ID,
  url: `/api/v1/field/uploads/${EVIDENCE_ID}/content/`,
  method: "PUT",
  headers: { "Content-Type": "image/png", "Upload-Lease": "test-lease-one" },
  expires_at: "2026-11-06T16:00:00Z",
});
const json = (body: unknown, status = 200) => Response.json(body, { status });

void test("total deadline fences a held real auth refresh before its replay closure; same evidence retries freshly", async (test) => {
  const h = await attachmentHarness(test);
  const event = makeEnvelope({ payload: { evidence_ids: [EVIDENCE_ID] } });
  assert.ok(
    await new EvidenceCapture(h).capture(
      { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
      event.id,
    ),
  );
  await h.outbox.enqueue(
    event,
    h.store.bindingStatements({
      eventId: event.id,
      evidenceIds: [EVIDENCE_ID],
      fence: await h.session.capture(),
    }),
  );
  const credentials = new CredentialStore(memorySecrets());
  const originalPair = { access: "test-access-before", refresh: "test-refresh-before" };
  await credentials.update(() => ({
    ...EMPTY_CREDENTIALS,
    origin: OWNER.issuer,
    sessionId: "session-one",
    pair: originalPair,
  }));
  const entered = deferred<undefined>();
  const refresh = deferred<{ access: string; refresh: string }>();
  const drained = deferred<undefined>();
  const actual = new ActualSessionRequests({
    credentials,
    isOnline: () => true,
    endSession: () => Promise.reject(new Error("Unexpected end")),
    refresh: () => {
      entered.resolve(undefined);
      return refresh.promise;
    },
  });
  let isHeld = false;
  const observed: Pick<SessionRequests, "run"> = {
    run: async (call) => {
      try {
        return await actual.run(call);
      } finally {
        if (isHeld) drained.resolve(undefined);
      }
    },
  };
  let hasExpired = false;
  let isFreshRetry = false;
  let forbiddenPuts = 0;
  let putCalls = 0;
  const client = createApiClient({
    baseUrl: OWNER.issuer,
    auth: { kind: "bearer", getAccessToken: credentials.getAccessToken },
    fetch: (request) => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/content/")) {
        putCalls++;
        if (hasExpired && !isFreshRetry) forbiddenPuts++;
        if (putCalls === 1) {
          isHeld = true;
          return Promise.resolve(
            json({ code: "token_expired", detail: "Expired test token", params: {} }, 401),
          );
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (path.endsWith("/renew/"))
        return Promise.resolve(
          json({ ...grant(), id: EVIDENCE_ID, state: "authorized", verified_at: null }),
        );
      if (path.endsWith("/finalize/"))
        return Promise.resolve(
          json({ id: EVIDENCE_ID, state: "verified", verified_at: NOW.toISOString() }),
        );
      return Promise.resolve(json(grant(), 201));
    },
  });
  const deadline = new AbortController();
  const sync = new AttachmentSync({
    ...h,
    now: () => NOW,
    createDeadline: (ms) => {
      assert.equal(ms, 30_000);
      return isFreshRetry ? new AbortController().signal : deadline.signal;
    },
    transport: new PrivateAttachmentTransport({
      client: () => client,
      requests: observed,
      assertCurrent: (fence) => h.session.assertCurrent(fence),
      requireActor: (fence) => {
        h.session.requireActor(fence);
      },
      requireAttempt: (call) =>
        h.store.requireAttempt({
          id: call.file.id,
          fence: call.fence,
          attemptVersion: call.attemptVersion,
        }),
    }),
  });
  const pending = sync.advanceOne();
  await entered.promise;
  const before = await h.db.query("SELECT state,verified_at,is_bound FROM attachment_file");
  hasExpired = true;
  deadline.abort();
  refresh.resolve({ access: "test-access-after", refresh: "test-refresh-after" });
  assert.equal(await pending, false);
  await drained.promise;
  assert.equal(forbiddenPuts, 0);
  assert.deepEqual(
    await h.db.query("SELECT state,verified_at,is_bound FROM attachment_file"),
    before,
  );
  isFreshRetry = true;
  await h.store.retryNow(await h.session.capture());
  assert.equal(await sync.advanceOne(), true);
  assert.equal(putCalls, 2);
  assert.equal(
    (await h.outbox.claimPending(50, await h.session.selection()))[0]?.envelope.id,
    event.id,
  );
});

void test("generated upload transport keeps original bytes/UUID across lost PUT, disk restart, renew and finalize before event send", async (test) => {
  const h = await attachmentHarness(test);
  let now = NOW;
  const saved = await new EvidenceCapture(h).capture(
    { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  assert.ok(saved);
  const event = makeEnvelope({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    payload: { evidence_ids: [EVIDENCE_ID] },
  });
  await h.outbox.enqueue(
    event,
    h.store.bindingStatements({
      eventId: event.id,
      evidenceIds: [EVIDENCE_ID],
      fence: await h.session.capture(),
    }),
  );
  let hasSource = false;
  let hasVerified = false;
  const bound = new Set<string>();
  const bindingEntered = deferred<undefined>();
  const bindingReply = deferred<Response>();
  let shouldDelayBinding = true;
  let puts = 0;
  const operations: string[] = [];
  const client = createApiClient({
    baseUrl: "https://api.example.test",
    auth: { kind: "bearer", getAccessToken: () => "test-access" },
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      operations.push(path);
      assert.equal(request.redirect, "error");
      assert.equal(request.credentials, "omit");
      assert.equal(request.headers.get("Authorization"), "Bearer test-access");
      if (path.endsWith("/content/")) {
        assert.deepEqual(new Uint8Array(await request.arrayBuffer()), new Uint8Array(PNG_BYTES));
        assert.equal(request.headers.get("Upload-Lease"), "test-lease-one");
        hasSource = true;
        puts++;
        throw new TypeError("Lost acknowledgement");
      }
      if (path.endsWith("/renew/"))
        return json({
          ...grant(),
          id: EVIDENCE_ID,
          state: hasVerified ? "verified" : hasSource ? "received" : "authorized",
          verified_at: hasVerified ? NOW.toISOString() : null,
        });
      if (path.endsWith("/finalize/")) {
        const body = (await request.json()) as { context?: { kind: string; id: string } };
        if (body.context) {
          assert.deepEqual(body.context, { kind: "field_event", id: event.id });
          bound.add(body.context.id);
          bindingEntered.resolve(undefined);
          return shouldDelayBinding
            ? bindingReply.promise
            : json({ id: EVIDENCE_ID, state: "verified", verified_at: NOW.toISOString() });
        }
        hasVerified = true;
        throw new TypeError("Lost finalize acknowledgement");
      }
      const body = (await request.json()) as Record<string, unknown>;
      assert.equal(body.client_id, EVIDENCE_ID);
      assert.equal(body.sha256, createHash("sha256").update(PNG_BYTES).digest("hex"));
      assert.equal(body.size_bytes, PNG_BYTES.byteLength);
      assert.equal(body.content_type, "image/png");
      assert.equal(Object.hasOwn(body, "context"), false);
      return json(grant(), 201);
    },
  });
  const build = (local: typeof h | Awaited<ReturnType<typeof h.reopen>>) =>
    new AttachmentSync({
      ...local,
      files: h.files,
      now: () => now,
      transport: new PrivateAttachmentTransport({
        client: () => client,
        requests,
        assertCurrent: (fence) => local.session.assertCurrent(fence),
        requireActor: (fence) => {
          local.session.requireActor(fence);
        },
        requireAttempt: (call) =>
          local.store.requireAttempt({
            id: call.file.id,
            fence: call.fence,
            attemptVersion: call.attemptVersion,
          }),
      }),
    });
  assert.equal(await build(h).advanceOne(), false);
  assert.equal((await h.outbox.claimPending(50, await h.session.selection())).length, 0);
  let reopened = await h.reopen();
  now = new Date(NOW.getTime() + 60_000);
  assert.equal(await build(reopened).advanceOne(), false);
  assert.equal(
    (await reopened.outbox.claimPending(50, await reopened.session.selection())).length,
    0,
  );
  reopened = await h.reopen();
  now = new Date(NOW.getTime() + 120_000);
  assert.equal(await build(reopened).advanceOne(), true);
  assert.equal(puts, 1);
  assert.equal(operations.filter((path) => path.endsWith("/finalize/")).length, 1);
  assert.equal(
    (await reopened.outbox.claimPending(50, await reopened.session.selection()))[0]?.envelope.id,
    event.id,
  );
  await reopened.outbox.settle([
    { id: event.id, action: "accept", result: { code: "accepted", params: {} } },
  ]);
  const binding = build(reopened).advanceOne();
  await bindingEntered.promise;
  await new DayStore(reopened.db).revoke();
  bindingReply.resolve(
    json({ id: EVIDENCE_ID, state: "verified", verified_at: NOW.toISOString() }),
  );
  assert.equal(await binding, false);
  assert.equal((await reopened.db.query("SELECT is_bound FROM attachment_file"))[0]?.is_bound, 0);
  assert.equal((await reopened.outbox.countByStatus()).sent, 1);
  h.setIdentity({ owner: OWNER, sessionId: "session-two" });
  shouldDelayBinding = false;
  assert.equal(await build(reopened).advanceOne(), true);
  assert.equal(bound.size, 1);
  assert.equal(puts, 1);
  assert.equal((await reopened.db.query("SELECT is_bound FROM attachment_file"))[0]?.is_bound, 1);
  assert.equal((await reopened.outbox.countByStatus()).sent, 1);
});

void test("one real engine uploads after unrelated JSON and final selection cannot upload bytes", async (test) => {
  const h = await attachmentHarness(test);
  const saved = await new EvidenceCapture(h).capture(
    { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  assert.ok(saved);
  const photo = makeEnvelope({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    payload: { evidence_ids: [EVIDENCE_ID] },
  });
  const unrelated = makeEnvelope({ payload: { evidence_ids: [] } });
  await h.outbox.enqueue(
    photo,
    h.store.bindingStatements({
      eventId: photo.id,
      evidenceIds: [EVIDENCE_ID],
      fence: await h.session.capture(),
    }),
  );
  await h.outbox.claimPending(1, { ...(await h.session.selection()), isFinal: true });
  await h.outbox.settle([
    { id: photo.id, action: "release", retryAt: new Date(NOW.getTime() - 1).toISOString() },
  ]);
  await h.outbox.enqueue(unrelated);
  const order: string[] = [];
  const scheduled: number[] = [];
  const transport = {
    authorize: () => {
      order.push("file");
      return Promise.reject(new Error("offline upload"));
    },
    renew: () => Promise.reject(new Error("Unexpected renew")),
    put: () => Promise.reject(new Error("Unexpected PUT")),
    finalize: () => Promise.reject(new Error("Unexpected finalize")),
  };
  const sync = new AttachmentSync({ ...h, transport, now: () => NOW });
  const engine = new SyncEngine({
    pass: {
      ...h,
      now: () => NOW,
      deviceId: "33333333-3333-4333-8333-333333333333",
      attachments: attachmentSyncHooks({ ...h, sync }),
      transport: (batch) => {
        order.push("json");
        if (batch.events.length)
          assert.deepEqual(
            batch.events.map((item) => item.id),
            [unrelated.id],
          );
        return Promise.resolve(
          answer(
            batch.events.map((item) => accepted(item.id)),
            { cursor: "next-cursor" },
          ),
        );
      },
    },
    hasSession: () => true,
    hasServer: () => true,
    hasPendingFinalUpload: () => Promise.resolve(false),
    random: () => 0,
    schedule: (_, delay) => {
      scheduled.push(delay);
      return () => undefined;
    },
    report: (error) => {
      throw error;
    },
  });
  engine.setOnline(true);
  await engine.requestSync();
  assert.deepEqual(order, ["json", "file"]);
  assert.equal((await h.outbox.countByStatus()).sent, 1);
  assert.equal(await h.kv.get("sync_cursor"), "next-cursor");
  assert.deepEqual(scheduled, [1500]);
  await engine.retryNow();
  assert.deepEqual(order, ["json", "file", "json", "file"]);
  assert.deepEqual(scheduled, [1500, 3000]);
  h.setIdentity(null);
  await h.session.selection();
  assert.equal(await sync.advanceOne(), false);
  assert.equal(order.length, 4);
  assert.deepEqual(
    (await h.outbox.claimPending(50, await h.session.selection())).map((item) => item.envelope.id),
    [photo.id],
  );
});

void test("verifying a declared photo never changes an immutable in-review verdict", async (test) => {
  const h = await attachmentHarness(test);
  const event = makeEnvelope({ payload: { evidence_ids: [EVIDENCE_ID] } });
  const capture = new EvidenceCapture(h);
  assert.ok(
    await capture.capture(
      { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
      event.id,
    ),
  );
  const fence = await h.session.capture();
  await h.outbox.enqueue(
    event,
    h.store.bindingStatements({ eventId: event.id, evidenceIds: [EVIDENCE_ID], fence }),
  );
  await h.outbox.claimPending(1, { fence, isFinal: true });
  await h.outbox.settle([
    { id: event.id, action: "review", result: { code: "final_upload_after_revoke", params: {} } },
  ]);
  const client = createApiClient({
    baseUrl: "https://api.example.test",
    auth: { kind: "bearer", getAccessToken: () => "test-access" },
    fetch: async (request) => {
      if (request.method === "PUT") return new Response(null, { status: 204 });
      const body = (await request.json()) as { context: { kind: string; id: string } };
      assert.deepEqual(body.context, { kind: "field_event", id: event.id });
      return new URL(request.url).pathname.endsWith("/finalize/")
        ? json({ id: EVIDENCE_ID, state: "verified", verified_at: NOW.toISOString() })
        : json(grant(), 201);
    },
  });
  const sync = new AttachmentSync({
    ...h,
    now: () => NOW,
    transport: new PrivateAttachmentTransport({
      client: () => client,
      requests,
      assertCurrent: (fence) => h.session.assertCurrent(fence),
      requireActor: (fence) => {
        h.session.requireActor(fence);
      },
      requireAttempt: (call) =>
        h.store.requireAttempt({
          id: call.file.id,
          fence: call.fence,
          attemptVersion: call.attemptVersion,
        }),
    }),
  });
  assert.equal(await sync.advanceOne(), true);
  assert.equal((await h.outbox.countByStatus()).in_review, 1);
  assert.equal((await h.outbox.countByStatus()).sent, 0);
});

void test("malicious upload grants cannot redirect bytes or change identity", async () => {
  const file = {
    id: EVIDENCE_ID,
    fileRef: "private-file",
    contentType: "image/png" as const,
    sizeBytes: 1,
    sha256: "a".repeat(64),
  };
  const fence = { ownerKey: "owner", sessionId: "session", generation: 1 };
  for (const corrupt of [
    { url: "https://outside.example.test/bytes" },
    { upload_id: "another" },
    { method: "POST" },
    { headers: { Authorization: "forbidden" } },
  ]) {
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      auth: { kind: "bearer", getAccessToken: () => "test-access" },
      fetch: () => Promise.resolve(json({ ...grant(), ...corrupt }, 201)),
    });
    const transport = new PrivateAttachmentTransport({
      client: () => client,
      requests,
      assertCurrent: () => Promise.resolve(),
      requireActor: () => undefined,
      requireAttempt: () => Promise.resolve(),
    });
    await assert.rejects(
      () => transport.authorize({ file, fence, signal: new AbortController().signal }),
      /upload_authorization/,
    );
  }
});

for (const phase of ["authorize", "content", "finalize"]) {
  void test(`late ${phase} response cannot release a file/event after canonical revoke and null ABA`, async (test) => {
    const h = await attachmentHarness(test);
    const saved = await new EvidenceCapture(h).capture(
      { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    );
    assert.ok(saved);
    await h.outbox.enqueue(
      makeEnvelope({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        payload: { evidence_ids: [EVIDENCE_ID] },
      }),
      h.store.bindingStatements({
        eventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        evidenceIds: [EVIDENCE_ID],
        fence: await h.session.capture(),
      }),
    );
    const entered = deferred<undefined>();
    const release = deferred<Response>();
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      auth: { kind: "bearer", getAccessToken: () => "test-access" },
      fetch: (request) => {
        const path = new URL(request.url).pathname;
        const step = path.endsWith("/content/")
          ? "content"
          : path.endsWith("/finalize/")
            ? "finalize"
            : "authorize";
        if (step === phase) {
          entered.resolve(undefined);
          return release.promise;
        }
        return Promise.resolve(
          step === "content" ? new Response(null, { status: 204 }) : json(grant(), 201),
        );
      },
    });
    const transport = new PrivateAttachmentTransport({
      client: () => client,
      requests,
      assertCurrent: (fence) => h.session.assertCurrent(fence),
      requireActor: (fence) => {
        h.session.requireActor(fence);
      },
      requireAttempt: (call) =>
        h.store.requireAttempt({
          id: call.file.id,
          fence: call.fence,
          attemptVersion: call.attemptVersion,
        }),
    });
    const sync = new AttachmentSync({ ...h, transport, now: () => NOW });
    const pending = sync.advanceOne();
    await entered.promise;
    await new DayStore(h.db).revoke();
    h.setIdentity(null);
    await h.session.selection();
    h.setIdentity({
      owner: {
        issuer: "https://api.example.test",
        organizationId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        deviceId: "33333333-3333-4333-8333-333333333333",
      },
      sessionId: "session-one",
    });
    await h.session.selection();
    release.resolve(
      phase === "content"
        ? new Response(null, { status: 204 })
        : phase === "finalize"
          ? json({ id: EVIDENCE_ID, state: "verified", verified_at: NOW.toISOString() })
          : json(grant(), 201),
    );
    assert.equal(await pending, false);
    assert.equal((await h.outbox.claimPending(50, await h.session.selection())).length, 0);
    const [row] = await h.db.query("SELECT state FROM attachment_file");
    assert.notEqual(row?.state, "verified");
    assert.equal((await h.outbox.countByStatus()).pending, 1);
  });
}

void test("a fresh username/Me without original session provenance cannot claim historical file ownership", () => {
  const me = loginResponse().me;
  const credentials = {
    ...EMPTY_CREDENTIALS,
    origin: "https://api.example.test",
    sessionId: "new-session",
    pair: { access: "test-access", refresh: "test-refresh" },
  };
  const profile = {
    username: me.user.username,
    firstName: me.user.first_name,
    organization: {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "test",
      name: "Test",
      country: "MX",
      timezone: "America/Mexico_City",
      languages: ["es-MX"],
      epi_week: "iso" as const,
      label_phone: "",
      support_contact: "",
      logo_url: null,
    },
    permissions: me.permissions,
  };
  assert.equal(
    acceptedEvidenceOwner({
      profile,
      credentials,
      deviceId: "33333333-3333-4333-8333-333333333333",
    }),
    null,
  );
  assert.equal(
    acceptedEvidenceOwner({
      profile: {
        ...profile,
        userId: me.user.id,
        sessionId: "original-session",
        issuer: credentials.origin,
      },
      credentials,
      deviceId: "33333333-3333-4333-8333-333333333333",
    }),
    null,
  );
  assert.ok(
    acceptedEvidenceOwner({
      profile: {
        ...profile,
        userId: me.user.id,
        sessionId: credentials.sessionId,
        issuer: credentials.origin,
      },
      credentials,
      deviceId: "33333333-3333-4333-8333-333333333333",
    }),
  );
});
