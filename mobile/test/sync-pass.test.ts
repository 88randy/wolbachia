import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { noticeFor } from "../src/sync/inbox-notice.ts";
import { INITIAL_SNAPSHOT } from "../src/sync/sync-snapshot.ts";
import { KV_KEYS } from "../src/db/kv-store.ts";
import { runSyncPass, SYNC_BATCH_SIZE } from "../src/sync/sync-pass.ts";
import type { PassState } from "../src/sync/sync-pass.ts";
import { createStores, FIXED_DEVICE_ID, FIXED_NOW, makeEnvelope } from "./support/factories.ts";
import type { TestStores } from "./support/factories.ts";
import {
  accepted,
  answer,
  failure,
  httpFailure,
  scriptedTransport,
} from "./support/scripted-transport.ts";
import type { ScriptedTransport } from "./support/scripted-transport.ts";

function deps(stores: TestStores, scripted: ScriptedTransport) {
  return {
    outbox: stores.outbox,
    kv: stores.kv,
    transport: scripted.transport,
    deviceId: FIXED_DEVICE_ID,
    now: () => FIXED_NOW,
  };
}

function review(eventId: string, kind: "rejected" | "in_review", code: string) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    event_id: eventId,
    kind,
    code,
    params: {},
    created_at: "2026-01-15T11:00:00Z",
  };
}

function freshState(): PassState {
  return { batchSize: SYNC_BATCH_SIZE };
}

async function enqueueMany(stores: TestStores, count: number) {
  const events = Array.from({ length: count }, () => makeEnvelope());
  for (const event of events) await stores.outbox.enqueue(event);
  return events;
}

void describe("sync pass", () => {
  void it("backs off for a missing event result while committing the results it did receive", async () => {
    const stores = await createStores();
    const [first, missing] = await enqueueMany(stores, 2);
    assert.ok(first && missing);
    const scripted = scriptedTransport([answer([accepted(first.id)])]);

    const outcome = await runSyncPass(deps(stores, scripted), freshState());

    assert.deepEqual(outcome, {
      kind: "retry",
      delayMs: null,
      countsAsFailure: true,
      code: "missing_event_result",
    });
    assert.equal(scripted.requests.length, 1);
    const [pending] = await stores.outbox.claimPending(10);
    assert.equal(pending?.envelope.id, missing.id);
    assert.equal(pending.attempts, 1);
    assert.equal(pending.lastError, "missing_event_result");
    assert.equal((await stores.outbox.countByStatus()).sent, 1);
  });

  void it("parks only the malformed envelope indices and sends the other events", async () => {
    const stores = await createStores();
    const [first, poisoned, third] = await enqueueMany(stores, 3);
    assert.ok(first && poisoned && third);
    const scripted = scriptedTransport([
      httpFailure(400, "validation_error", {
        fieldCodes: { "events.1.type": ["invalid"], "events.1": ["invalid"] },
      }),
      answer([accepted(first.id), accepted(third.id)]),
    ]);

    await runSyncPass(deps(stores, scripted), freshState());

    assert.deepEqual(
      scripted.requests[1]?.events.map((event) => event.id),
      [first.id, third.id],
    );
    assert.deepEqual(
      (await stores.outbox.listProblems(10)).map((event) => event.id),
      [poisoned.id],
    );
    assert.equal((await stores.outbox.countByStatus()).sent, 2);
  });

  void it("retains quota-limited evidence until the server deadline, including after restart", async () => {
    const original = await createStores();
    let now = FIXED_NOW;
    const stores = { ...original, outbox: new OutboxRepository(original.db, () => now) };
    const [limited, allowed] = await enqueueMany(stores, 2);
    assert.ok(limited && allowed);
    const scripted = scriptedTransport([
      answer([
        {
          id: limited.id,
          status: "rejected",
          code: "rejection_quota_exceeded",
          params: { retry_after_seconds: 43_200 },
        },
        accepted(allowed.id),
      ]),
    ]);
    const outcome = await runSyncPass(deps(stores, scripted), freshState());
    assert.deepEqual(outcome, {
      kind: "retry",
      delayMs: 43_200_000,
      countsAsFailure: false,
      code: "rejection_quota_exceeded",
    });
    assert.equal((await stores.outbox.countByStatus()).pending, 1);
    assert.equal((await stores.outbox.countByStatus()).rejected, 0);
    assert.equal(
      noticeFor({
        ...INITIAL_SNAPSHOT,
        phase: "waitingRetry",
        lastFailureCode: "rejection_quota_exceeded",
      })?.messageKey,
      "mobile.inbox.rejectionQuota",
    );
    const restarted = new OutboxRepository(original.db, () => now);
    assert.deepEqual(await restarted.claimPending(10), []);
    now = new Date(FIXED_NOW.getTime() + 43_200_000);
    assert.equal(await restarted.nextRetryDelayMs(), 0);
    const retry = scriptedTransport([answer([accepted(limited.id)])]);
    await runSyncPass(deps({ ...stores, outbox: restarted }, retry), freshState());
    assert.deepEqual(retry.requests[0]?.events, [limited]);
    assert.equal((await restarted.countByStatus()).sent, 2);
    const [stored] = await original.db.query("SELECT attempts FROM outbox_event WHERE id = ?", [
      limited.id,
    ]);
    assert.equal(stored?.attempts, 0);
  });

  void it("stores what the server decided for each event, with its code, and saves the cursor and versions", async () => {
    const stores = await createStores();
    const [ok, refused, reviewed] = await enqueueMany(stores, 3);
    assert.ok(ok && refused && reviewed);
    const scripted = scriptedTransport([
      answer(
        [
          accepted(ok.id),
          { id: refused.id, status: "rejected", code: "void_target_not_found", params: { x: 1 } },
          { id: reviewed.id, status: "in_review", code: "clock_skew", params: {} },
        ],
        {
          cursor: "c1",
          catalogVersion: "cat-2",
          rulesVersion: "rules-2",
          // The server lists a review item for the events of this batch it refused; they must not clash with `results`.
          reviews: [review(refused.id, "rejected", "void_target_not_found")],
        },
      ),
    ]);

    const outcome = await runSyncPass(deps(stores, scripted), freshState());

    assert.deepEqual(outcome, { kind: "idle" });
    assert.deepEqual(await stores.outbox.countByStatus(), {
      pending: 0,
      sending: 0,
      sent: 1,
      error: 0,
      in_review: 1,
      rejected: 1,
    });
    assert.deepEqual(
      (await stores.outbox.listProblems(10)).map((item) => item.result?.code).sort(),
      ["clock_skew", "void_target_not_found"],
    );
    assert.equal(await stores.kv.get(KV_KEYS.syncCursor), "c1");
    assert.equal(await stores.kv.get(KV_KEYS.catalogVersion), "cat-2");
    assert.equal(await stores.kv.get(KV_KEYS.rulesVersion), "rules-2");
  });

  void it("sends events in capture order with the device id and the saved cursor, and keeps pulling while there is more", async () => {
    const stores = await createStores();
    const [first, second] = await enqueueMany(stores, 2);
    assert.ok(first && second);
    await stores.kv.set(KV_KEYS.syncCursor, "c0");
    const scripted = scriptedTransport([
      answer([accepted(first.id), accepted(second.id)], { cursor: "c1", hasMore: true }),
      answer([], { cursor: "c2" }),
    ]);

    await runSyncPass(deps(stores, scripted), freshState());

    const [firstRequest, secondRequest] = scripted.requests;
    assert.ok(firstRequest && secondRequest);
    assert.equal(scripted.requests.length, 2);
    assert.deepEqual(
      firstRequest.events.map((event) => event.id),
      [first.id, second.id],
    );
    assert.equal(firstRequest.device_id, FIXED_DEVICE_ID);
    assert.equal(firstRequest.cursor, "c0");
    assert.deepEqual(secondRequest.events, []);
    assert.equal(secondRequest.cursor, "c1");
  });

  void it("asks the server even with nothing to send (a pure pull)", async () => {
    const stores = await createStores();
    const scripted = scriptedTransport([answer([])]);

    const outcome = await runSyncPass(deps(stores, scripted), freshState());

    assert.deepEqual(outcome, { kind: "idle" });
    assert.equal(scripted.requests.length, 1);
  });

  void it("keeps the events and counts an attempt when there is no network", async () => {
    const stores = await createStores();
    const [event] = await enqueueMany(stores, 1);
    assert.ok(event);
    const scripted = scriptedTransport([failure({ kind: "network" })]);

    const outcome = await runSyncPass(deps(stores, scripted), freshState());

    assert.deepEqual(outcome, {
      kind: "retry",
      delayMs: null,
      countsAsFailure: true,
      code: "network",
    });
    const [again] = await stores.outbox.claimPending(10);
    assert.ok(again);
    assert.equal(again.attempts, 1);
    assert.equal(again.lastError, "network");
  });

  void it("keeps the events untouched and stops when the token expired while offline", async () => {
    const stores = await createStores();
    await enqueueMany(stores, 2);
    const scripted = scriptedTransport([httpFailure(401, "token_expired")]);

    const outcome = await runSyncPass(deps(stores, scripted), freshState());

    assert.deepEqual(outcome, { kind: "blocked", reason: "needsLogin", code: "token_expired" });
    const counts = await stores.outbox.countByStatus();
    assert.equal(counts.pending, 2);
    const batch = await stores.outbox.claimPending(10);
    assert.deepEqual(
      batch.map((event) => event.attempts),
      [0, 0],
    );
  });

  void it("waits as the server asks without counting an attempt", async () => {
    const stores = await createStores();
    await enqueueMany(stores, 1);
    const scripted = scriptedTransport([
      httpFailure(429, "sync_in_progress", { retryAfterSeconds: 2 }),
    ]);

    const outcome = await runSyncPass(deps(stores, scripted), freshState());

    assert.deepEqual(outcome, {
      kind: "retry",
      delayMs: 2000,
      countsAsFailure: false,
      code: "sync_in_progress",
    });
    assert.equal((await stores.outbox.claimPending(10))[0]?.attempts, 0);
  });

  void it("sends smaller batches after a 413 and remembers the smaller size", async () => {
    const stores = await createStores();
    const events = await enqueueMany(stores, 4);
    const scripted = scriptedTransport([
      httpFailure(413, "payload_too_large"),
      answer(events.slice(0, 2).map((event) => accepted(event.id))),
      answer(events.slice(2).map((event) => accepted(event.id))),
    ]);
    const state = freshState();

    await runSyncPass(deps(stores, scripted), state);

    assert.deepEqual(
      scripted.requests.map((request) => request.events.length),
      [4, 2, 2],
    );
    assert.equal(state.batchSize, 2);
    assert.equal((await stores.outbox.countByStatus()).sent, 4);
  });

  void it("drops the cursor on invalid_cursor and resends without it, once", async () => {
    const stores = await createStores();
    const [event] = await enqueueMany(stores, 1);
    assert.ok(event);
    await stores.kv.set(KV_KEYS.syncCursor, "forged");
    const scripted = scriptedTransport([
      httpFailure(400, "invalid_cursor"),
      answer([accepted(event.id)], { cursor: "fresh" }),
    ]);

    await runSyncPass(deps(stores, scripted), freshState());

    assert.equal(scripted.requests[0]?.cursor, "forged");
    assert.equal(scripted.requests[1]?.cursor, undefined);
    assert.equal(await stores.kv.get(KV_KEYS.syncCursor), "fresh");
    assert.equal((await stores.outbox.countByStatus()).sent, 1);
  });

  void it("repeats a failed pure pull without the cursor too", async () => {
    const stores = await createStores();
    await stores.kv.set(KV_KEYS.syncCursor, "forged");
    const scripted = scriptedTransport([httpFailure(400, "invalid_cursor"), answer([])]);

    const outcome = await runSyncPass(deps(stores, scripted), freshState());

    assert.deepEqual(outcome, { kind: "idle" });
    assert.equal(scripted.requests.length, 2);
  });

  void it("parks a batch the server calls malformed as error, with the code, until a person retries", async () => {
    const stores = await createStores();
    await enqueueMany(stores, 1);
    const scripted = scriptedTransport([httpFailure(400, "validation_error")]);

    const outcome = await runSyncPass(deps(stores, scripted), freshState());

    assert.deepEqual(outcome, { kind: "idle" });
    const [parked] = await stores.outbox.listProblems(10);
    assert.ok(parked);
    assert.equal(parked.status, "error");
    assert.equal(parked.lastError, "validation_error");
    assert.equal(await stores.outbox.retryParked(), 1);
    assert.equal((await stores.outbox.countByStatus()).pending, 1);
  });

  void it("learns from a pulled review about an event whose answer was lost, and does not send it again", async () => {
    const stores = await createStores();
    const [sent, lost] = await enqueueMany(stores, 2);
    assert.ok(sent && lost);
    const scripted = scriptedTransport([
      answer([accepted(sent.id)], { reviews: [review(lost.id, "in_review", "clock_skew")] }),
    ]);

    await runSyncPass(deps(stores, scripted), { batchSize: 1 });

    assert.equal(scripted.requests.length, 1);
    const counts = await stores.outbox.countByStatus();
    assert.equal(counts.sent, 1);
    assert.equal(counts.in_review, 1);
    assert.equal(counts.pending, 0);
  });
});
