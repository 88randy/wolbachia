import assert from "node:assert/strict";
import { test } from "node:test";
import type { ImagePickerResult, ImagePickerOptions } from "expo-image-picker";
import { CameraError, createPhotoAcquisitionPort } from "../src/attachments/photo-acquisition.ts";
import type { CameraPicker, CameraPermission } from "../src/attachments/photo-acquisition.ts";
import { EvidenceError, MAX_EVIDENCE_BYTES } from "../src/attachments/types.ts";
import type { EvidenceCaptureContext } from "../src/features/ovitrap-check/types.ts";
import { deferred } from "./support/auth-fakes.ts";
import { harness } from "./support/m-08-harness.ts";
import { makeDraft } from "./support/m-08-fixtures.ts";
import { runCaptureAction } from "../src/features/ovitrap-check/use-capture-actions.ts";
import { actionErrorKey } from "../src/features/ovitrap-check/action-error-key.ts";

const URI = "file:///cache/camera.png";
const ID = "66666666-6666-4666-8666-666666666666";
const granted = permission(true, true);
function permission(isGranted: boolean, canAskAgain: boolean): CameraPermission {
  return { granted: isGranted, canAskAgain };
}
function photo(
  patch: Partial<NonNullable<ImagePickerResult["assets"]>[number]> = {},
): ImagePickerResult {
  return { canceled: false, assets: [{ uri: URI, width: 1, height: 1, type: "image", ...patch }] };
}
function context(controller = new AbortController()): EvidenceCaptureContext {
  return {
    draftId: "11111111-1111-4111-8111-111111111111",
    signal: controller.signal,
    assertCurrent: () =>
      controller.signal.aborted
        ? Promise.reject(new EvidenceError("stale_context"))
        : Promise.resolve(),
  };
}
function fixture(overrides: Partial<CameraPicker> = {}, canStart = () => true) {
  const calls: string[] = [];
  const picker: CameraPicker = {
    getPendingResultAsync: () => {
      calls.push("pending");
      return Promise.resolve(null);
    },
    getCameraPermissionsAsync: () => {
      calls.push("permission");
      return Promise.resolve(granted);
    },
    requestCameraPermissionsAsync: () => {
      calls.push("request");
      return Promise.resolve(granted);
    },
    launchCameraAsync: () => {
      calls.push("camera");
      return Promise.resolve(photo());
    },
    ...overrides,
  };
  let ids = 0;
  return {
    calls,
    port: createPhotoAcquisitionPort({
      picker,
      canStart,
      uuid: () => {
        ids++;
        return ID;
      },
    }),
    ids: () => ids,
  };
}

void test("cold orphan is read and ignored; only a fresh camera-only result receives our UUID", async () => {
  let options: ImagePickerOptions | undefined;
  const h = fixture({
    getPendingResultAsync: () => Promise.resolve(photo({ uri: "file:///cache/orphan.png" })),
    launchCameraAsync: (input) => {
      options = input;
      return Promise.resolve(photo({ exif: { GPSLatitude: 1 }, base64: "never-adopt" }));
    },
  });
  assert.deepEqual(await h.port.capture(context()), { id: ID, fileRef: URI });
  assert.deepEqual(options, {
    mediaTypes: ["images"],
    allowsEditing: false,
    base64: false,
    exif: false,
    quality: 1,
  });
  assert.equal(h.ids(), 1);
});

void test("denied and permanently denied camera permission never launch or mint an identity", async () => {
  for (const canAskAgain of [true, false]) {
    const denied = permission(false, canAskAgain);
    let requests = 0;
    const h = fixture({
      getCameraPermissionsAsync: () => Promise.resolve(denied),
      requestCameraPermissionsAsync: () => {
        requests++;
        return Promise.resolve(denied);
      },
    });
    await assert.rejects(
      h.port.capture(context()),
      (error: unknown) =>
        error instanceof CameraError &&
        error.code === (canAskAgain ? "camera_permission_denied" : "camera_permission_blocked"),
    );
    assert.equal(requests, Number(canAskAgain));
    assert.equal(h.ids(), 0);
    assert.ok(!h.calls.includes("camera"));
  }
});

void test("permission prompt lock requires unlock and retry before launching; launched camera may finish behind the gate", async () => {
  let isUnlocked = true;
  let hasPermission = false;
  const h = fixture(
    {
      getCameraPermissionsAsync: () => Promise.resolve(permission(hasPermission, true)),
      requestCameraPermissionsAsync: () => {
        isUnlocked = false;
        hasPermission = true;
        return Promise.resolve(granted);
      },
      launchCameraAsync: () => {
        isUnlocked = false;
        return Promise.resolve(photo());
      },
    },
    () => isUnlocked,
  );
  await assert.rejects(h.port.capture(context()), /camera_unlock_required/);
  assert.equal(h.ids(), 0);
  isUnlocked = true;
  assert.deepEqual(await h.port.capture(context()), { id: ID, fileRef: URI });
  assert.equal(isUnlocked, false);
  assert.equal(h.ids(), 1);
  assert.equal(h.calls.filter((call) => call === "pending").length, 1);
});

void test("cancelled native work holds single flight until settlement and cannot join a newer draft", async () => {
  const camera = deferred<ImagePickerResult>();
  const opened = deferred<undefined>();
  let launches = 0;
  const h = fixture({
    launchCameraAsync: () => {
      launches++;
      opened.resolve(undefined);
      return launches === 1 ? camera.promise : Promise.resolve(photo());
    },
  });
  const owner = new AbortController();
  const old = h.port.capture(context(owner));
  await opened.promise;
  owner.abort();
  await assert.rejects(h.port.capture(context()), /camera_busy/);
  assert.equal(launches, 1);
  camera.resolve(photo());
  await assert.rejects(old, /stale_context/);
  assert.deepEqual(await h.port.capture(context()), { id: ID, fileRef: URI });
  assert.equal(launches, 2);
});

void test("a failed cold-result read is retryable and SDK failures expose only a named safe error", async () => {
  let reads = 0;
  const h = fixture({
    getPendingResultAsync: () =>
      ++reads === 1
        ? Promise.reject(new Error("file:///private/name secret provider detail"))
        : Promise.resolve(null),
  });
  await assert.rejects(
    h.port.capture(context()),
    (error: unknown) => error instanceof CameraError && error.message === "camera_unavailable",
  );
  assert.deepEqual(await h.port.capture(context()), { id: ID, fileRef: URI });
  assert.equal(reads, 2);
});

void test("cancellation is quiet; invalid, unsupported and oversized native assets never become evidence", async () => {
  const cases: readonly [ImagePickerResult, string | null][] = [
    [{ canceled: true, assets: null }, null],
    [{ canceled: false, assets: [] }, "camera_result_invalid"],
    [photo({ uri: "" }), "camera_result_invalid"],
    [photo({ uri: "https://example.test/image" }), "camera_result_invalid"],
    [photo({ type: "video" }), "file_type"],
    [photo({ mimeType: "image/heic" }), "file_type"],
    [photo({ fileSize: MAX_EVIDENCE_BYTES + 1 }), "file_size"],
    [photo({ fileSize: 0 }), "file_size"],
  ];
  for (const [result, code] of cases) {
    const h = fixture({ launchCameraAsync: () => Promise.resolve(result) });
    if (code === null) assert.equal(await h.port.capture(context()), null);
    else
      await assert.rejects(h.port.capture(context()), (error: unknown) => {
        assert.match(error instanceof Error ? error.message : "", new RegExp(code));
        const expected =
          code === "file_type"
            ? "mobile.camera.fileType"
            : code === "file_size"
              ? "mobile.camera.fileSize"
              : "mobile.camera.resultInvalid";
        assert.equal(actionErrorKey(error), expected);
        return true;
      });
  }
});

void test("a retired request cannot cross any pending-result or permission await into the camera", async () => {
  for (const boundary of [
    "getPendingResultAsync",
    "getCameraPermissionsAsync",
    "requestCameraPermissionsAsync",
  ] as const) {
    const owner = new AbortController();
    const h = fixture({
      getCameraPermissionsAsync: () => Promise.resolve(permission(false, true)),
      [boundary]: () => {
        owner.abort();
        return Promise.resolve(boundary === "getPendingResultAsync" ? null : granted);
      },
    });
    await assert.rejects(h.port.capture(context(owner)), /stale_context/);
    assert.equal(h.ids(), 0);
    assert.ok(!h.calls.includes("camera"));
  }
});

void test("the action runner keeps camera cancellation quiet and retires later UI callbacks on unmount", async () => {
  const h = await harness(undefined, { evidence: { capture: () => Promise.resolve(null) } });
  const draft = makeDraft();
  await h.store.begin(draft);
  let refreshes = 0;
  const errors: unknown[] = [];
  const input = {
    service: h.service,
    buffer: h.service.draftBuffer,
    refresh: () => {
      refreshes++;
      return Promise.resolve();
    },
    setError: (key: unknown) => {
      errors.push(key);
    },
  };
  assert.equal(
    await runCaptureAction(input, () => h.service.captureEvidence(draft.eventId), {
      eventId: draft.eventId,
    }),
    true,
  );
  assert.deepEqual(errors, [null]);
  assert.deepEqual((await h.store.read()).draft?.evidence, []);
  refreshes = 0;
  errors.length = 0;
  const entered = deferred<undefined>();
  const native = deferred<undefined>();
  const controller = new AbortController();
  const running = runCaptureAction(
    input,
    () => {
      entered.resolve(undefined);
      return native.promise;
    },
    { eventId: draft.eventId, signal: controller.signal },
  );
  await entered.promise;
  controller.abort();
  native.reject(new EvidenceError("stale_context"));
  assert.equal(await running, false);
  assert.equal(refreshes, 0);
  assert.deepEqual(errors, [null]);
  const replacement = new AbortController();
  const replacementErrors: unknown[] = [];
  const replacing = {
    ...input,
    setError: (key: unknown) => {
      replacementErrors.push(key);
      if (key === "mobile.ovitrap.staleView") replacement.abort();
    },
  };
  assert.equal(
    await runCaptureAction(replacing, () => Promise.reject(new EvidenceError("stale_context")), {
      eventId: draft.eventId,
      signal: replacement.signal,
    }),
    false,
  );
  assert.equal(refreshes, 0);
  assert.deepEqual(replacementErrors, [null, "mobile.ovitrap.staleView"]);
});
