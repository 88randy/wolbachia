import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setStatement } from "../src/db/kv-store.ts";
import { makeEnvelope, createStores } from "./support/factories.ts";

void describe("outbox repository", () => {
  void it("hands out pending events oldest first and marks them sending", async () => {
    const { outbox } = await createStores();
    const first = makeEnvelope();
    const second = makeEnvelope();
    await outbox.enqueue(first);
    await outbox.enqueue(second);

    const batch = await outbox.claimPending(1);

    assert.deepEqual(
      batch.map((event) => event.envelope.id),
      [first.id],
    );
    assert.equal((await outbox.countByStatus()).sending, 1);
    assert.deepEqual(
      (await outbox.claimPending(10)).map((event) => event.envelope.id),
      [second.id],
    );
  });

  void it("returns the envelope exactly as it was saved", async () => {
    const { outbox } = await createStores();
    const envelope = makeEnvelope({
      shift_id: "22222222-2222-4222-8222-222222222222",
      gps: { lat: 19.43, lng: -99.13, accuracy_m: 8.5 },
      manual_capture: true,
      voids_event_id: "33333333-3333-4333-8333-333333333333",
    });
    await outbox.enqueue(envelope);

    const [stored] = await outbox.claimPending(1);

    assert.deepEqual(stored?.envelope, envelope);
  });

  void it("puts events a killed app left in sending back to pending, without counting an attempt", async () => {
    const { outbox } = await createStores();
    await outbox.enqueue(makeEnvelope());
    await outbox.claimPending(10);

    const recovered = await outbox.recoverInterrupted();

    assert.equal(recovered, 1);
    const [again] = await outbox.claimPending(10);
    assert.equal(again?.attempts, 0);
  });

  void it("never deletes an event and never changes its envelope", async () => {
    const { db, outbox } = await createStores();
    const envelope = makeEnvelope();
    await outbox.enqueue(envelope);

    await assert.rejects(
      db.runAtomically([{ sql: "DELETE FROM outbox_event WHERE id = ?", params: [envelope.id] }]),
      /never deleted/,
    );
    await assert.rejects(
      db.runAtomically([
        { sql: "UPDATE outbox_event SET payload = '{}' WHERE id = ?", params: [envelope.id] },
      ]),
      /never changes/,
    );
  });

  void it("applies status changes and the new cursor in one transaction, or neither", async () => {
    const { kv, outbox } = await createStores();
    const envelope = makeEnvelope();
    await outbox.enqueue(envelope);
    await outbox.claimPending(10);
    const cursor = setStatement("sync_cursor", "cursor-1");
    const failing = { sql: "INSERT INTO table_that_does_not_exist VALUES (1)" };

    await assert.rejects(outbox.settle([{ id: envelope.id, action: "accept" }], [cursor, failing]));

    assert.equal(await kv.get("sync_cursor"), null);
    assert.equal((await outbox.countByStatus()).sending, 1);
    await outbox.settle([{ id: envelope.id, action: "accept" }], [cursor]);
    assert.equal(await kv.get("sync_cursor"), "cursor-1");
    assert.equal((await outbox.countByStatus()).sent, 1);
  });

  void it("refuses a status change the state machine does not allow", async () => {
    const { outbox } = await createStores();
    const envelope = makeEnvelope();
    await outbox.enqueue(envelope);

    await assert.rejects(outbox.settle([{ id: envelope.id, action: "accept" }]), /not allowed/);

    assert.equal((await outbox.countByStatus()).pending, 1);
  });

  void it("plans a pulled review only for events that are known and not final", async () => {
    const { outbox } = await createStores();
    const known = makeEnvelope();
    await outbox.enqueue(known);
    const review = (eventId: string) => ({
      eventId,
      kind: "rejected" as const,
      result: { code: "void_target_not_found", params: {} },
    });

    const first = await outbox.pulledReviewTransitions([review(known.id), review("unknown")]);
    await outbox.settle(first);
    const second = await outbox.pulledReviewTransitions([review(known.id)]);

    assert.deepEqual(
      first.map((change) => change.id),
      [known.id],
    );
    assert.deepEqual(second, []);
    assert.equal((await outbox.countByStatus()).rejected, 1);
  });

  void it("groups what is on the phone by type with the span of its times, and lists problems separately", async () => {
    const { outbox } = await createStores();
    const [early, late, other, parked] = [
      makeEnvelope({ type: "ovitrap.check", device_time: "2026-01-15T09:02:00.000Z" }),
      makeEnvelope({ type: "ovitrap.check", device_time: "2026-01-15T11:20:00.000Z" }),
      makeEnvelope({ type: "fuel.load", device_time: "2026-01-15T10:00:00.000Z" }),
      makeEnvelope({ type: "incident.report" }),
    ];
    for (const event of [early, late, other, parked]) await outbox.enqueue(event);
    await outbox.settle([{ id: parked.id, action: "claim" }]);
    await outbox.settle([
      { id: parked.id, action: "failPermanent", lastError: "validation_error" },
    ]);

    const groups = await outbox.groupByType(["pending", "sending"]);
    const problems = await outbox.listProblems(10);

    const checks = groups.find((group) => group.type === "ovitrap.check");
    assert.equal(groups.length, 2);
    assert.ok(checks);
    assert.equal(checks.total, 2);
    assert.equal(checks.firstDeviceTime, "2026-01-15T09:02:00.000Z");
    assert.equal(checks.lastDeviceTime, "2026-01-15T11:20:00.000Z");
    assert.deepEqual(
      problems.map((item) => [item.id, item.status, item.lastError]),
      [[parked.id, "error", "validation_error"]],
    );
  });

  void it("reports a failed write as OutboxWriteError and saves nothing", async () => {
    const { outbox } = await createStores();
    const envelope = makeEnvelope();
    await outbox.enqueue(envelope);

    await assert.rejects(outbox.enqueue(envelope), { name: "OutboxWriteError" });

    assert.equal((await outbox.countByStatus()).pending, 1);
  });
});
