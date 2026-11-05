import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import type { SqlStatement } from "../src/db/sql.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import type { SyncEngineDeps } from "../src/sync/sync-engine.ts";
import type { SyncCallResult, SyncTransport } from "../src/sync/sync-transport.ts";
import { createStores, FIXED_DEVICE_ID, FIXED_NOW, makeEnvelope } from "./support/factories.ts";
import type { TestStores } from "./support/factories.ts";
import { accepted, answer, failure } from "./support/scripted-transport.ts";

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface Harness {
  readonly engine: SyncEngine;
  readonly stores: TestStores;
  readonly scheduled: number[];
  readonly reported: unknown[];
}

async function harness(
  transport: SyncTransport,
  overrides: Partial<SyncEngineDeps> = {},
): Promise<Harness> {
  const stores = await createStores();
  const scheduled: number[] = [];
  const reported: unknown[] = [];
  const engine = new SyncEngine({
    pass: {
      outbox: stores.outbox,
      kv: stores.kv,
      transport,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
    },
    hasSession: () => true,
    hasServer: () => true,
    random: () => 0,
    schedule: (_callback, delayMs) => {
      scheduled.push(delayMs);
      return () => undefined;
    },
    report: (error) => reported.push(error),
    ...overrides,
  });
  return { engine, stores, scheduled, reported };
}

void describe("sync engine", () => {
  void it("never runs two passes at once: requests made during a pass add exactly one more pass", async () => {
    const gate = deferred<SyncCallResult>();
    const reached = deferred<undefined>();
    let calls = 0;
    const transport: SyncTransport = () => {
      calls += 1;
      if (calls > 1) return Promise.resolve(answer([]));
      reached.resolve(undefined);
      return gate.promise;
    };
    const { engine } = await harness(transport);

    const running = engine.requestSync();
    await reached.promise;
    const duringPass = [engine.requestSync(), engine.requestSync(), engine.requestSync()];
    assert.equal(calls, 1);
    gate.resolve(answer([]));
    await running;
    await Promise.all(duringPass);

    assert.equal(calls, 2);
  });

  void it("waits for the backoff after a failure and does not hammer the server", async () => {
    const { engine, scheduled, stores } = await harness(() =>
      Promise.resolve(failure({ kind: "network" })),
    );
    await stores.outbox.enqueue(makeEnvelope());

    await engine.requestSync();

    assert.deepEqual(scheduled, [1000]);
    assert.equal(engine.getSnapshot().phase, "waitingRetry");
    assert.equal(engine.getSnapshot().counts.pending, 1);
  });

  void it("keeps only the latest retry timer when another pass was queued during a failure", async () => {
    const first = deferred<SyncCallResult>();
    const reached = deferred<undefined>();
    let calls = 0;
    let activeTimers = 0;
    const { engine } = await harness(
      () => {
        calls += 1;
        if (calls === 1) {
          reached.resolve(undefined);
          return first.promise;
        }
        return Promise.resolve(failure({ kind: "network" }));
      },
      {
        schedule: () => {
          activeTimers += 1;
          return () => {
            activeTimers -= 1;
          };
        },
      },
    );
    const running = engine.requestSync();
    await reached.promise;
    void engine.requestSync();
    first.resolve(failure({ kind: "network" }));

    await running;

    assert.equal(calls, 2);
    assert.equal(activeTimers, 1);
  });

  void it("sends nothing without a session or a server, and says why", async () => {
    let calls = 0;
    const transport: SyncTransport = () => {
      calls += 1;
      return Promise.resolve(answer([]));
    };
    const noSession = await harness(transport, { hasSession: () => false });
    const noServer = await harness(transport, { hasServer: () => false });

    await noSession.engine.requestSync();
    await noServer.engine.requestSync();

    assert.equal(calls, 0);
    assert.equal(noSession.engine.getSnapshot().blockReason, "needsLogin");
    assert.equal(noServer.engine.getSnapshot().blockReason, "noServer");
  });

  void it("does not try while offline, but a manual retry does", async () => {
    let calls = 0;
    const transport: SyncTransport = () => {
      calls += 1;
      return Promise.resolve(answer([]));
    };
    const { engine } = await harness(transport);
    engine.setOnline(false);

    await engine.requestSync();
    assert.equal(calls, 0);
    await engine.retryNow();

    assert.equal(calls, 1);
  });

  void it("puts events a killed app left in sending back in the queue at startup, then sends them", async () => {
    const event = makeEnvelope();
    const transport: SyncTransport = () => Promise.resolve(answer([accepted(event.id)]));
    const { engine, stores } = await harness(transport);
    await stores.outbox.enqueue(event);
    await stores.outbox.claimPending(10);

    await engine.start();
    await engine.requestSync();

    assert.equal(engine.getSnapshot().counts.sent, 1);
  });

  void it("recovers an event after saving its answer fails, then sends it next pass", async () => {
    const event = makeEnvelope();
    const sent: string[] = [];
    const transport: SyncTransport = (request) => {
      sent.push(...request.events.map((item) => item.id));
      return Promise.resolve(answer(request.events.map((item) => accepted(item.id))));
    };
    const { engine, reported, stores } = await harness(transport);
    await stores.outbox.enqueue(event);
    const run = stores.db.runAtomically.bind(stores.db);
    let failOnce = true;
    mock.method(stores.db, "runAtomically", async (statements: readonly SqlStatement[]) => {
      if (failOnce && statements.some((statement) => statement.params?.[0] === "sent")) {
        failOnce = false;
        throw new Error("Disk full");
      }
      await run(statements);
    });

    await engine.requestSync();

    assert.equal(reported.length, 1);
    assert.equal((await stores.outbox.countByStatus()).pending, 1);
    assert.equal((await stores.outbox.countByStatus()).sending, 0);
    await engine.requestSync();
    assert.equal((await stores.outbox.countByStatus()).sent, 1);
    assert.deepEqual(sent, [event.id, event.id]);
  });

  void it("repeated start calls cannot recover an event being uploaded by the live worker", async () => {
    const gate = deferred<SyncCallResult>();
    const reached = deferred<undefined>();
    const event = makeEnvelope();
    let calls = 0;
    const { engine, stores } = await harness(() => {
      calls += 1;
      reached.resolve(undefined);
      return gate.promise;
    });
    await stores.outbox.enqueue(event);
    const starting = engine.start();
    await reached.promise;
    const startingAgain = engine.start();
    assert.equal(startingAgain, starting);
    // A repeated mount must not release the active upload.
    await Promise.resolve();
    assert.equal((await stores.outbox.countByStatus()).sending, 1);
    gate.resolve(answer([accepted(event.id)]));
    await Promise.all([starting, startingAgain]);
    await engine.requestSync();
    assert.equal((await stores.outbox.countByStatus()).sent, 1);
    assert.equal(calls, 2);
  });
});
