import assert from "node:assert/strict";
import { test } from "node:test";

import { describeWriteFailure } from "../src/features/diagnostics/diagnostic-log.ts";
import { actionErrorKey } from "../src/features/ovitrap-check/action-error-key.ts";
import { CaptureBlockedError } from "../src/features/ovitrap-check/ports.ts";
import { POINT } from "./support/m-08-fixtures.ts";
import { currentEventId, harness } from "./support/m-08-harness.ts";

const LABEL = "wbf:1:ovitrap:66666666-6666-4666-8666-666666666666";

async function readyPlacement() {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  const eventId = await currentEventId(h.store);
  assert.equal(await h.service.bindLabel(LABEL, false, eventId), "read");
  await h.service.update(
    {
      point: POINT,
      prepared: ["clean", "water", "liner", "shade", "height", "containers", "safe", "marked"],
      reviewAcknowledged: true,
    },
    eventId,
  );
  await h.service.captureEvidence(eventId);
  return { h, eventId };
}

void test("a draft saved before organization settings existed still saves, using the current ones", async () => {
  const { h, eventId } = await readyPlacement();
  // The 11-nov-era draft: its assignment snapshot has no organization (time zone, epi-week rule).
  await h.db.runAtomically([
    {
      sql: "UPDATE ovitrap_draft SET draft=json_remove(draft,'$.assignment.organization') WHERE slot=1",
    },
  ]);
  const old = (await h.store.read()).draft;
  assert.ok(old?.assignment);
  assert.equal(old.assignment.organization, undefined);
  const saved = await h.service.save(eventId);
  assert.equal(saved.event?.envelope.type, "ovitrap.place");
});

void test("a retired point says so with a real reason instead of a generic error", async () => {
  const { h, eventId } = await readyPlacement();
  await h.db.runAtomically([
    {
      sql: "UPDATE lifecycle_courier_projection SET body=json_set(body,'$.is_retired',json('true')) WHERE kind='sampling_point' AND id=?",
      params: [POINT.id],
    },
  ]);
  const error = await h.service.save(eventId).then(
    () => null,
    (failure: unknown) => failure,
  );
  assert.ok(error instanceof CaptureBlockedError);
  assert.equal(error.gate, "retired");
  assert.equal(actionErrorKey(error), "mobile.ovitrap.blockedRetired");
});

void test("the technical line keeps our fixed message and the throwing function", () => {
  function failsHere(): never {
    throw new Error("Missing physical identity state.");
  }
  let line = "";
  try {
    failsHere();
  } catch (error) {
    line = describeWriteFailure(error);
  }
  assert.match(line, /Missing physical identity state\./);
  assert.match(line, /@failsHere/);
  const masked = describeWriteFailure(
    new Error("bad 66666666-6666-4666-8666-666666666666 'Maria Lopez' 123456789"),
  );
  assert.doesNotMatch(masked, /Maria|66666666|123456789/);
});
