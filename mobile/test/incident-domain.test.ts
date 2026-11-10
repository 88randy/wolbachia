import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import {
  callWorkContact,
  incidentEvent,
  IncidentError,
  telephoneNumber,
} from "../src/features/incidents/domain.ts";
import type { IncidentDraft } from "../src/features/incidents/types.ts";

const draft: IncidentDraft = {
  eventId: "original-event",
  ownerKey: "owner",
  kind: "accident",
  shiftId: null,
  deviceTime: "2026-11-06T12:00:00Z",
  catalogVersion: "catalog",
  rulesVersion: "rules",
  description: "",
  type: null,
  evidence: [],
  gps: null,
};
void test("M12 field copy retains Spanish accents and progress punctuation after Windows edits", () => {
  for (const locale of ["es-MX", "en"] as const) {
    const copy = Object.entries(messages[locale]).filter(([key]) =>
      key.startsWith("mobile.incidents."),
    );
    assert.ok(copy.length);
    assert.ok(copy.every(([, text]) => !text.includes("?")));
  }
  assert.ok(messages["es-MX"]["mobile.incidents.saved"].includes("teléfono"));
});
void test("M12 detail-free accident keeps original identity and no fabricated GPS, scope or delivery", () => {
  const event = incidentEvent(draft);
  assert.equal(event.id, draft.eventId);
  assert.equal(event.device_time, draft.deviceTime);
  assert.equal(event.type, "emergency.accident");
  assert.deepEqual(event.payload, { description: "emergency.accident", evidence_ids: [] });
  assert.equal(event.gps, null);
  assert.throws(() => incidentEvent({ ...draft, kind: "report" }), IncidentError);
});
void test("M12 configured call rejects URI injection and distinguishes absent, denied and opened dialer", async () => {
  let opened = "";
  const dialer = {
    open: (uri: string) => {
      opened = uri;
      return Promise.resolve();
    },
  };
  for (const value of [null, "Contact support", "tel:911", "123;456", "123\n456", "+1?x=4"]) {
    assert.equal(telephoneNumber(value), null);
    assert.equal(await callWorkContact(dialer, value), "missing");
  }
  assert.equal(opened, "");
  assert.equal(await callWorkContact(dialer, "+52 (555) 000-0000"), "opened");
  assert.equal(opened, "tel:+525550000000");
  assert.equal(
    await callWorkContact({ open: () => Promise.reject(new Error("denied")) }, "5550000000"),
    "unavailable",
  );
});
