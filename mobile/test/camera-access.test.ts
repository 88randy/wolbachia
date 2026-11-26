import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureCameraAccess } from "../src/features/scanner/camera-access.ts";
import type { CameraPermission } from "../src/features/scanner/camera-access.ts";

function request(result: CameraPermission) {
  const calls = { count: 0 };
  return {
    calls,
    ask: () => {
      calls.count++;
      return Promise.resolve(result);
    },
  };
}

void test("the camera permission is requested when it is not granted yet", async () => {
  const granted = request({ granted: true, canAskAgain: true });
  assert.equal(await ensureCameraAccess(null, granted.ask), "granted");
  assert.equal(granted.calls.count, 1);
  const undetermined = request({ granted: true, canAskAgain: true });
  assert.equal(
    await ensureCameraAccess({ granted: false, canAskAgain: true }, undetermined.ask),
    "granted",
  );
  assert.equal(undetermined.calls.count, 1);
});

void test("an already granted permission does not ask again", async () => {
  const none = request({ granted: false, canAskAgain: false });
  assert.equal(await ensureCameraAccess({ granted: true, canAskAgain: true }, none.ask), "granted");
  assert.equal(none.calls.count, 0);
});

void test("a refusal is never silent: ask again, or open the settings when the system will not ask", async () => {
  assert.equal(
    await ensureCameraAccess(null, request({ granted: false, canAskAgain: true }).ask),
    "denied",
  );
  assert.equal(
    await ensureCameraAccess(null, request({ granted: false, canAskAgain: false }).ask),
    "blocked",
  );
});

void test("a failing permission call rejects so the screen can show the camera problem", async () => {
  await assert.rejects(
    ensureCameraAccess(null, () => Promise.reject(new Error("native"))),
    /native/,
  );
});
