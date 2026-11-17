import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { captureConfiguration } from "../src/attachments/capture-configuration.ts";
import { createPhotoAcquisitionPort } from "../src/attachments/photo-acquisition.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import { OutboxWriteError } from "../src/outbox/outbox-repository.ts";
import { FixtureEvidenceCapture as EvidenceCapture } from "./support/capture-fixture.ts";
import { attachmentHarness } from "./support/attachment-fixtures.ts";
import { makeEnvelope } from "./support/factories.ts";
import { POINT } from "./support/m-08-fixtures.ts";
import { currentEventId, harness, serviceFor } from "./support/m-08-harness.ts";

const DAY = 24 * 60 * 60 * 1000;
const LABEL = "wbf:1:ovitrap:66666666-6666-4666-8666-666666666666";
const PHOTOS = ["aaaaaaaa-1111-4111-8111-000000000001", "aaaaaaaa-1111-4111-8111-000000000002"];

/** Draft started in shift A, shift A closed, no shift open, real attachment journal, 2 photos. */
void test("a stale placement with two real photos saves with no shift open after its shift closed", async (test) => {
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
  assert.equal(started.evidence.length, 2);

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
  await later.continueStale(eventId);
  const saved = await later
    .save(eventId)
    .catch((error: unknown) => (error instanceof OutboxWriteError ? error.diagnostic : error));
  assert.equal(typeof saved === "string" ? saved : "saved", "saved");
  assert.equal(typeof saved, "object");
});
