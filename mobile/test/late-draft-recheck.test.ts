import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { captureConfiguration } from "../src/attachments/capture-configuration.ts";
import { createPhotoAcquisitionPort } from "../src/attachments/photo-acquisition.ts";
import { DISCARD_REMEDY } from "../src/features/ovitrap-check/discard-remedy.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import { FixtureEvidenceCapture as EvidenceCapture } from "./support/capture-fixture.ts";
import { attachmentHarness } from "./support/attachment-fixtures.ts";
import { makeEnvelope } from "./support/factories.ts";
import { POINT } from "./support/m-08-fixtures.ts";
import { currentEventId, harness, serviceFor } from "./support/m-08-harness.ts";

const DAY = 24 * 60 * 60 * 1000;
const LABEL = "wbf:1:ovitrap:66666666-6666-4666-8666-666666666666";
const PHOTOS = ["aaaaaaaa-1111-4111-8111-000000000001", "aaaaaaaa-1111-4111-8111-000000000002"];

/** A placement with two real photos, its shift closed, no shift open the next day. */
async function lateDraftWithPhotos(test: Parameters<typeof attachmentHarness>[0]) {
  const h = await attachmentHarness(test);
  let taken = 0;
  const configuration = captureConfiguration({
    store: new OvitrapStore(h.db),
    port: createPhotoAcquisitionPort({
      uuid: () => PHOTOS[taken++] ?? PHOTOS[1] ?? "",
      canStart: () => true,
      picker: {
        getPendingResultAsync: () => Promise.resolve(null),
        getCameraPermissionsAsync: () => Promise.resolve({ granted: true, canAskAgain: true }),
        requestCameraPermissionsAsync: () => Promise.reject(new Error("Unexpected prompt")),
        launchCameraAsync: () =>
          Promise.resolve({
            canceled: false,
            assets: [{ uri: pathToFileURL(h.source).href, width: 1, height: 1 }],
          }),
      },
    }),
    attachments: { ...h, capture: new EvidenceCapture(h) },
  });
  const wired = await harness(h, configuration);
  await wired.service.startPlace(await currentEventId(wired.store));
  const eventId = await currentEventId(wired.store);
  assert.equal(await wired.service.bindLabel(LABEL, false, eventId), "read");
  await wired.service.update(
    {
      point: POINT,
      prepared: ["clean", "water", "liner", "shade", "height", "containers", "safe", "marked"],
      reviewAcknowledged: true,
    },
    eventId,
  );
  await wired.service.captureEvidence(eventId);
  await wired.service.captureEvidence(eventId);
  const started = (await wired.store.read()).draft;
  assert.ok(started);
  await wired.outbox.enqueue(
    makeEnvelope({
      type: "shift.close",
      shift_id: started.shiftId,
      device_time: new Date(Date.parse(started.deviceTime) + 60_000).toISOString(),
    }),
  );
  const later = serviceFor(
    { store: wired.store, engine: wired.engine },
    {
      ...configuration,
      now: () => new Date(Date.parse(started.deviceTime) + DAY),
      shiftId: () => Promise.resolve(""),
    },
  );
  return { h, wired, later, eventId };
}

void test("a draft already chosen to finish late is checked again when it is reopened", async (test) => {
  const { wired, later, eventId } = await lateDraftWithPhotos(test);
  await later.continueStale(eventId);
  assert.equal((await later.read()).staleDraft, null);
  assert.deepEqual(await later.unfinishedSummary(), { count: 1, isDiscardOnly: false });
  // The point leaves the phone's capture scope after the choice.
  await wired.db.runAtomically([
    { sql: "UPDATE day_sampling_point SET removed=1 WHERE id=?", params: [POINT.id] },
  ]);
  const reopened = await later.read();
  assert.equal(reopened.staleDraft?.invalidReason, "scope");
  assert.deepEqual(await later.unfinishedSummary(), { count: 1, isDiscardOnly: true });
});

void test("a draft that can only be discarded drops its unsent photos without clearing anything else", async (test) => {
  const { h, wired, later, eventId } = await lateDraftWithPhotos(test);
  await later.continueStale(eventId);
  await wired.db.runAtomically([
    { sql: "UPDATE day_sampling_point SET removed=1 WHERE id=?", params: [POINT.id] },
  ]);
  assert.equal((await h.db.query("SELECT id FROM attachment_file")).length, 2);
  await later.discardStale(eventId);
  assert.equal((await wired.store.read()).draft, null);
  assert.equal((await h.db.query("SELECT id FROM attachment_file")).length, 0);
  // The closed shift's event is untouched.
  assert.equal((await h.outbox.countByStatus()).pending, 1);
});

void test("the banner offers discarding for the failures that cannot be fixed by retrying", () => {
  assert.ok(DISCARD_REMEDY.includes("mobile.storage.scopeUnavailable"));
  assert.ok(DISCARD_REMEDY.includes("mobile.ovitrap.blockedRetired"));
  assert.ok(!DISCARD_REMEDY.includes("mobile.storage.unexpected"));
});
