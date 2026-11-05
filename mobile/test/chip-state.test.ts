import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveChipState } from "../src/sync/chip-state.ts";
import { noticeFor } from "../src/sync/inbox-notice.ts";
import { EMPTY_COUNTS, INITIAL_SNAPSHOT } from "../src/sync/sync-snapshot.ts";
import type { SyncSnapshot } from "../src/sync/sync-snapshot.ts";
import { createTranslate } from "../src/i18n/translate.ts";
import { presentChip } from "../src/ui/chip-presentation.ts";
import type { OutboxStatus } from "../src/outbox/outbox-status.ts";

function snapshot(
  counts: Partial<Record<OutboxStatus, number>>,
  overrides: Partial<SyncSnapshot> = {},
): SyncSnapshot {
  return { ...INITIAL_SNAPSHOT, counts: { ...EMPTY_COUNTS, ...counts }, ...overrides };
}

void describe("top-bar sync chip", () => {
  void it("shows all sent when nothing waits, even if the server rejected or reviewed some records", () => {
    assert.deepEqual(deriveChipState(snapshot({})), { kind: "allSent" });
    assert.deepEqual(deriveChipState(snapshot({ sent: 5, rejected: 1, in_review: 2 })), {
      kind: "allSent",
    });
  });

  void it("counts pending and sending records as to upload", () => {
    assert.deepEqual(deriveChipState(snapshot({ pending: 3, sending: 2 })), {
      kind: "toUpload",
      count: 5,
    });
  });

  void it("shows no signal, with the count, when the phone is offline", () => {
    assert.deepEqual(deriveChipState(snapshot({ pending: 12 }, { isOnline: false })), {
      kind: "noSignal",
      count: 12,
    });
    assert.deepEqual(deriveChipState(snapshot({}, { isOnline: false })), {
      kind: "noSignal",
      count: 0,
    });
  });

  void it("shows error for parked records, and for a stopped worker only when something waits", () => {
    assert.deepEqual(deriveChipState(snapshot({ error: 1, pending: 2 })), { kind: "error" });
    assert.deepEqual(
      deriveChipState(snapshot({ pending: 1 }, { blockReason: "needsLogin", phase: "blocked" })),
      { kind: "error" },
    );
    assert.deepEqual(
      deriveChipState(snapshot({}, { blockReason: "needsLogin", phase: "blocked" })),
      {
        kind: "allSent",
      },
    );
  });

  void it("puts an error above no signal", () => {
    assert.deepEqual(deriveChipState(snapshot({ error: 1 }, { isOnline: false })), {
      kind: "error",
    });
  });

  void it("has words in both languages for every state (they are the TalkBack label)", () => {
    const states = [
      { kind: "allSent" },
      { kind: "toUpload", count: 12 },
      { kind: "noSignal", count: 12 },
      { kind: "noSignal", count: 0 },
      { kind: "error" },
    ] as const;
    for (const locale of ["es-MX", "en"] as const) {
      const t = createTranslate(locale);
      for (const state of states) {
        const { messageKey, params } = presentChip(state);
        const label = t(messageKey, params);
        assert.ok(label.length > 0 && !label.includes("{"), `${locale} ${state.kind}: ${label}`);
      }
    }
  });
});

void describe("inbox notice", () => {
  void it("explains why sending is paused before anything else", () => {
    const paused = snapshot({ pending: 1 }, { blockReason: "clockWrong", isOnline: false });

    assert.equal(noticeFor(paused)?.messageKey, "mobile.blocked.clockWrong");
  });

  void it("says there is no signal, then that the app will retry, then nothing", () => {
    assert.equal(noticeFor(snapshot({}, { isOnline: false }))?.messageKey, "mobile.inbox.offline");
    assert.equal(
      noticeFor(snapshot({}, { phase: "waitingRetry" }))?.messageKey,
      "mobile.inbox.waitingRetry",
    );
    assert.equal(noticeFor(snapshot({})), null);
  });
});
