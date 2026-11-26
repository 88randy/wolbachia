import assert from "node:assert/strict";
import { test } from "node:test";
import { CameraBroker } from "../src/attachments/camera-broker.ts";
import { createInAppCameraPicker } from "../src/attachments/in-app-camera-picker.ts";
import { createPhotoAcquisitionPort } from "../src/attachments/photo-acquisition.ts";

const GRANTED = {
  getCameraPermissionsAsync: () => Promise.resolve({ granted: true, canAskAgain: true }),
  requestCameraPermissionsAsync: () => Promise.resolve({ granted: true, canAskAgain: true }),
};
const CONTEXT = {
  draftId: "d",
  signal: new AbortController().signal,
  assertCurrent: () => Promise.resolve(),
};
const PHOTO_ID = "11111111-1111-4111-8111-111111111111";

function port(broker: CameraBroker, permissions = GRANTED) {
  return createPhotoAcquisitionPort({
    picker: createInAppCameraPicker(broker, permissions),
    uuid: () => PHOTO_ID,
    canStart: () => true,
  });
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

void test("the photo port opens the in-app camera and returns the kept file", async () => {
  const broker = new CameraBroker();
  const pending = port(broker).capture(CONTEXT);
  await tick();
  assert.equal(broker.isOpen(), true);
  broker.settle("file:///cache/photo.jpg");
  assert.deepEqual(await pending, { id: PHOTO_ID, fileRef: "file:///cache/photo.jpg" });
  assert.equal(broker.isOpen(), false);
});

void test("closing the camera without a photo is a cancel, not an error", async () => {
  const broker = new CameraBroker();
  const pending = port(broker).capture(CONTEXT);
  await tick();
  broker.settle(null);
  assert.equal(await pending, null);
});

void test("a blocked camera permission never opens the camera", async () => {
  const broker = new CameraBroker();
  const blocked = {
    ...GRANTED,
    getCameraPermissionsAsync: () => Promise.resolve({ granted: false, canAskAgain: false }),
  };
  await assert.rejects(() => port(broker, blocked).capture(CONTEXT), {
    code: "camera_permission_blocked",
  });
  assert.equal(broker.isOpen(), false);
});

void test("a second request while the camera is open is refused", async () => {
  const broker = new CameraBroker();
  const first = broker.request();
  await assert.rejects(() => broker.request(), /camera_busy/);
  broker.settle(null);
  assert.equal(await first, null);
});
