import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeWriteFailure, DiagnosticLog } from "../src/features/diagnostics/diagnostic-log.ts";
import { diagnosticSink } from "../src/features/diagnostics/diagnostic-sink.ts";
import { storedLocationStatus } from "../src/features/ovitrap-check/location-status.ts";
import { KvStore } from "../src/db/kv-store.ts";
import { OutboxWriteError } from "../src/outbox/outbox-repository.ts";
import { writeErrorKey } from "../src/outbox/write-error-key.ts";
import { createStores, makeEnvelope } from "./support/factories.ts";

void describe("technical line of a failed save", () => {
  void it("names the constraint, the column and the statement, never values", () => {
    const line = describeWriteFailure(
      new Error("NOT NULL constraint failed: attachment_event.evidence_id"),
      [
        { sql: "INSERT INTO outbox_event(id) VALUES (?)" },
        { sql: "INSERT INTO attachment_event(evidence_id,event_id) VALUES(?,?)" },
      ],
    );
    assert.match(line, /^Código: SQLITE_CONSTRAINT_NOTNULL attachment_event\.evidence_id/);
    assert.match(line, /\[INSERT attachment_event\]/);
  });

  void it("recognizes the other SQLite kinds", () => {
    assert.match(describeWriteFailure(new Error("FOREIGN KEY constraint failed")), /FOREIGNKEY/);
    assert.match(
      describeWriteFailure(new Error("UNIQUE constraint failed: ovitrap_capture.ovitrap_id")),
      /UNIQUE ovitrap_capture\.ovitrap_id/,
    );
    assert.match(describeWriteFailure(new Error("database or disk is full")), /SQLITE_FULL/);
  });

  void it("never quotes a JSON error, which can hold data", () => {
    const line = describeWriteFailure(new SyntaxError('Unexpected token "secret-name" in JSON'));
    assert.doesNotMatch(line, /secret/);
  });

  void it("keeps our own fixed message of a non-SQL failure", () => {
    assert.match(describeWriteFailure(new Error("The physical ovitrap is retired.")), /retired/);
  });

  void it("an unexpected non-write failure is logged and reads as unexpected", () => {
    assert.equal(writeErrorKey(new Error("boom")), "mobile.storage.unexpected");
  });
});

void describe("diagnostic log", () => {
  void it("keeps the last lines on the phone and reloads them", async () => {
    const { db } = await createStores();
    const first = new DiagnosticLog();
    await first.attach(diagnosticSink(new KvStore(db)));
    first.record("Código: A");
    first.record("Código: B");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = new DiagnosticLog();
    await second.attach(diagnosticSink(new KvStore(db)));
    assert.deepEqual(
      second.entries().map((entry) => entry.line),
      ["Código: A", "Código: B"],
    );
  });

  void it("an outbox write failure records its line with the failing statement", async () => {
    const { db, outbox } = await createStores();
    await db.runAtomically([
      {
        sql: "CREATE TRIGGER fail_it BEFORE INSERT ON outbox_event BEGIN SELECT RAISE(ABORT, 'blocked on purpose'); END",
      },
    ]);
    const error = await outbox.enqueue(makeEnvelope()).then(
      () => null,
      (failure: unknown) => failure,
    );
    assert.ok(error instanceof OutboxWriteError);
    assert.match(error.diagnostic, /^Código: /);
  });
});

void describe("location of a draft finished late", () => {
  void it("uses the stored fix and never searches", () => {
    assert.deepEqual(storedLocationStatus({ accuracy_m: 100 }), { kind: "ready", accuracyM: 100 });
    assert.deepEqual(storedLocationStatus(null), { kind: "missing" });
  });
});
