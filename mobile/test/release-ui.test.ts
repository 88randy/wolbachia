import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import { RELEASE_GATE_NAMES } from "../src/features/releases/view-model.ts";
import type { ReleaseViewModel } from "../src/features/releases/view-model.ts";
import { ReleaseEditBuffer } from "../src/features/releases/edit-buffer.ts";
import { ReleaseEditorController } from "../src/features/releases/editor-controller.ts";
import type { ReleaseState } from "../src/features/releases/types.ts";
import { releaseDraft, RELEASE_IDS } from "./support/release-fixtures.ts";
import { deferred } from "./support/auth-fakes.ts";
import { componentHarness, flattenStyle } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

const FEATURE = "mobile/src/features/releases/";
const NO_ACTION = () => undefined;
function model(patch: Partial<ReleaseViewModel> = {}): ReleaseViewModel {
  return {
    isLoading: false,
    isBusy: false,
    errorKey: null,
    refs: { deviceId: "device-139", taskId: "task-139", permitId: "permit-139", lotId: "lot-139" },
    quantity: "125.50",
    quantityErrorKey: null,
    gates: RELEASE_GATE_NAMES.map((name) => ({ name, state: "pass", contact: "supervisor" })),
    canEdit: true,
    canSave: true,
    taskOptions: [{ id: "task-139", code: "TASK-139" }],
    deviceOptions: [{ id: "device-139", code: "DEV-139" }],
    selectedTaskId: "task-139",
    selectedDeviceId: "device-139",
    hasDraft: true,
    canBegin: false,
    hasPendingEdits: false,
    selectTask: NO_ACTION,
    selectDevice: NO_ACTION,
    begin: NO_ACTION,
    status: "draft",
    resultKey: null,
    reviewedKey: null,
    evidenceCount: 1,
    photoUri: "file:///private/release-139.png",
    requiresEvidence: true,
    evidencePending: false,
    gpsAccuracy: 4,
    changeQuantity: NO_ACTION,
    blurQuantity: NO_ACTION,
    acquireGps: NO_ACTION,
    capturePhoto: NO_ACTION,
    undoPhoto: NO_ACTION,
    save: NO_ACTION,
    retry: NO_ACTION,
    reportSupervisor: NO_ACTION,
    reportDevice: NO_ACTION,
    openInbox: NO_ACTION,
    goBackToDay: NO_ACTION,
    ...patch,
  };
}
function texts(nodes: readonly RenderNode[]) {
  return nodes.filter((node) => node.type === "Text").map((node) => node.props.children);
}
function presses(nodes: readonly RenderNode[]) {
  return nodes.filter((node) => node.type === "Pressable");
}
function press(node: RenderNode | undefined): void {
  assert.ok(node);
  assert.equal(typeof node.props.onPress, "function");
  (node.props.onPress as () => void)();
}
function minTarget(node: RenderNode): number {
  const style =
    typeof node.props.style === "function"
      ? (node.props.style as (input: { pressed: boolean }) => unknown)({ pressed: false })
      : node.props.style;
  return Number(flattenStyle(style).minHeight);
}
const MATRIX = (["es-MX", "en"] as const).flatMap((locale) =>
  (["light", "dark"] as const).flatMap((scheme) =>
    [1, 1.3].map((fontScale) => ({ locale, scheme, fontScale })),
  ),
);

void test("P18 host matrix preserves raw quantity, named references, GPS, photo undo and full-width Save", () => {
  for (const options of MATRIX) {
    const render = componentHarness(options).render;
    const calls: string[] = [];
    const capture = model({
      changeQuantity: (value) => {
        calls.push(value);
      },
      acquireGps: () => {
        calls.push("gps");
      },
      capturePhoto: () => {
        calls.push("photo");
      },
      undoPhoto: () => {
        calls.push("undo");
      },
      save: () => {
        calls.push("save");
      },
    });
    const form = render(`${FEATURE}ReleaseCapture.tsx`, "ReleaseCapture", { model: capture });
    const input = form.find((node) => node.type === "TextInput");
    assert.ok(input);
    assert.equal(
      input.props.accessibilityLabel,
      messages[options.locale]["mobile.release.quantity"],
    );
    assert.equal(input.props.value, "125.50");
    assert.equal(input.props.keyboardType, "decimal-pad");
    assert.equal(input.props.editable, true);
    assert.ok(minTarget(input) >= 48);
    (input.props.onChangeText as (value: string) => void)("invalid raw quantity");
    press(presses(form)[0]);
    const refs = render(`${FEATURE}ReleaseReferences.tsx`, "ReleaseReferences", {
      refs: capture.refs,
    });
    assert.ok(Object.values(capture.refs).every((reference) => texts(refs).includes(reference)));
    const photo = render(`${FEATURE}ReleaseEvidence.tsx`, "ReleaseEvidence", { model: capture });
    assert.equal(
      photo.find((node) => node.type === "Image")?.props.accessibilityLabel,
      messages[options.locale]["mobile.release.photoPreview"],
    );
    press(presses(photo)[0]);
    press(presses(photo)[1]);
    const footer = render(`${FEATURE}ReleaseFooter.tsx`, "ReleaseFooter", { model: capture });
    const save = presses(footer)[0];
    assert.ok(save);
    assert.equal(save.props.disabled, false);
    assert.ok(minTarget(save) >= 48);
    press(save);
    assert.deepEqual(calls, ["invalid raw quantity", "gps", "photo", "undo", "save"]);
    checkScaling([...form, ...photo, ...footer, ...refs]);
  }
});
function checkScaling(nodes: readonly RenderNode[]): void {
  for (const node of nodes.filter((node) => node.type === "Text")) {
    assert.equal(node.props.numberOfLines, undefined);
    assert.notEqual(node.props.allowFontScaling, false);
    assert.ok(Number(flattenStyle(node.props.style).fontSize) >= 12);
  }
}

void test("P19 blocks every missing or failed prerequisite even when a stale caller enables Save", () => {
  for (const locale of ["es-MX", "en"] as const) {
    const render = componentHarness({ locale, scheme: "dark", fontScale: 1.3 }).render;
    const cases = RELEASE_GATE_NAMES.flatMap((name) => [
      model({
        gates: model().gates.map((gate) =>
          gate.name === name ? { ...gate, state: "fail" as const } : gate,
        ),
      }),
      model({
        gates: model().gates.map((gate) =>
          gate.name === name ? { ...gate, state: "unavailable" as const } : gate,
        ),
      }),
      model({ gates: model().gates.filter((gate) => gate.name !== name) }),
    ]);
    for (const capture of cases) assertBlocked({ render, locale, capture });
  }
});
function assertBlocked({
  render,
  locale,
  capture,
}: {
  readonly render: ReturnType<typeof componentHarness>["render"];
  readonly locale: Locale;
  readonly capture: ReleaseViewModel;
}): void {
  const footer = render(`${FEATURE}ReleaseFooter.tsx`, "ReleaseFooter", { model: capture });
  assert.equal(presses(footer)[0]?.props.disabled, true);
  assert.ok(texts(footer).includes(messages[locale]["mobile.release.noBypass"]));
  assert.ok(texts(footer).includes(messages[locale]["mobile.release.reportSupervisor"]));
  const gates = render(`${FEATURE}ReleaseGates.tsx`, "ReleaseGates", { gates: capture.gates });
  assert.ok(texts(gates).includes(messages[locale]["mobile.release.contact.supervisor"]));
  assert.ok(texts(gates).includes(messages[locale]["mobile.release.noBypass"]));
}

void test("P18 separates phone save, pending evidence, server receipt, review and critical rejection", () => {
  for (const locale of ["es-MX", "en"] as const) {
    const render = componentHarness({ locale, scheme: "light", fontScale: 1.3 }).render;
    const content = (capture: ReleaseViewModel) =>
      texts(render(`${FEATURE}ReleaseStatus.tsx`, "ReleaseStatus", { model: capture }));
    const saved = content(model({ status: "phone_saved", evidencePending: true }));
    assert.ok(saved.includes(messages[locale]["mobile.release.phoneSaved"]));
    assert.ok(saved.includes(messages[locale]["mobile.release.evidencePending"]));
    assert.ok(!saved.includes(messages[locale]["mobile.release.serverReceived"]));
    assert.ok(!saved.includes(messages[locale]["mobile.release.inReview"]));
    const received = content(model({ status: "server_received" }));
    assert.ok(received.includes(messages[locale]["mobile.release.serverReceived"]));
    assert.ok(!received.includes(messages[locale]["mobile.release.phoneSaved"]));
    const reviewed = content(model({ status: "in_review" }));
    assert.ok(reviewed.includes(messages[locale]["mobile.release.inReview"]));
    assert.ok(!reviewed.includes(messages[locale]["mobile.release.serverReceived"]));
    const rejected = content(
      model({ status: "critical_rejected", resultKey: "sync.result.releasePermitSuspended" }),
    );
    assert.ok(rejected.includes(messages[locale]["mobile.release.criticalRejected"]));
    assert.ok(rejected.includes(messages[locale]["sync.result.releasePermitSuspended"]));
    const footer = render(`${FEATURE}ReleaseFooter.tsx`, "ReleaseFooter", {
      model: model({ status: "critical_rejected" }),
    });
    assert.equal(presses(footer).length, 1);
    assert.ok(texts(footer).includes(messages[locale]["mobile.release.backToDay"]));
    assert.ok(!texts(footer).includes(messages[locale]["mobile.release.save"]));
  }
});

void test("P18 local read failure keeps retry and all partial blockers visible without an enabled capture", () => {
  const render = componentHarness({ locale: "en", scheme: "dark", fontScale: 1.3 }).render;
  const loading = render(`${FEATURE}ReleaseContent.tsx`, "ReleaseContent", {
    model: model({ isLoading: true }),
  });
  assert.ok(texts(loading).includes(messages.en["mobile.release.loading"]));
  assert.equal(
    loading.some((node) => node.type === "ActivityIndicator"),
    false,
  );
  assert.equal(
    loading.some((node) => node.type === "TextInput"),
    false,
  );
  const calls: string[] = [];
  const unavailable = model({
    errorKey: "mobile.release.detail.contractUnavailable",
    gates: [],
    canEdit: false,
    canSave: false,
    retry: () => {
      calls.push("retry");
    },
  });
  const partial = render(`${FEATURE}ReleaseContent.tsx`, "ReleaseContent", { model: unavailable });
  assert.ok(texts(partial).includes(messages.en["mobile.release.detail.contractUnavailable"]));
  assert.ok(texts(partial).includes(messages.en["mobile.release.gate.lot"]));
  assert.ok(texts(partial).includes(messages.en["mobile.release.gate.device"]));
  assert.equal(partial.find((node) => node.type === "TextInput")?.props.editable, false);
  press(presses(partial)[0]);
  assert.deepEqual(calls, ["retry"]);
});

void test("P18 chooses exact downloaded task/device identities and prepares only an explicit complete selection", () => {
  const render = componentHarness({ locale: "en", scheme: "light", fontScale: 1.3 }).render;
  const selected: string[] = [];
  const capture = model({
    selectTask: (id) => {
      selected.push(id);
    },
    selectDevice: (id) => {
      selected.push(id);
    },
    gates: model().gates.map((gate) =>
      gate.name === "schedule" ? { ...gate, state: "unavailable" } : gate,
    ),
    canSave: true,
  });
  const options = render(`${FEATURE}ReleaseChoices.tsx`, "ReleaseChoices", {
    model: capture,
  });
  assert.ok(texts(options).includes(messages.en["mobile.release.selectionHint"]));
  assert.equal(presses(options)[0]?.props.disabled, false);
  press(presses(options)[0]);
  press(presses(options)[1]);
  assert.deepEqual(selected, ["task-139", "device-139"]);
  const begin = render(`${FEATURE}ReleaseBegin.tsx`, "ReleaseBegin", {
    model: { ...capture, hasDraft: false, canBegin: false },
  });
  assert.equal(presses(begin)[0]?.props.disabled, true);
  const footer = render(`${FEATURE}ReleaseFooter.tsx`, "ReleaseFooter", { model: capture });
  assert.equal(presses(footer)[0]?.props.disabled, true);
});

function editorState(patch: Partial<ReleaseState> = {}): ReleaseState {
  return {
    draft: releaseDraft(),
    event: null,
    ready: true,
    evidencePending: false,
    review: null,
    gates: model().gates,
    tasks: [{ id: RELEASE_IDS.task, code: "TASK-139" }],
    devices: [{ id: RELEASE_IDS.device, code: "DEV-139" }],
    ...patch,
  };
}
function notifications() {
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: () => {
      for (const listener of listeners) listener();
    },
  };
}
function editorHarness() {
  let stored = editorState(),
    identity = "original-owner-session",
    unlocked = true;
  const auth = notifications(),
    scope = notifications(),
    signal = notifications();
  const buffer = new ReleaseEditBuffer();
  const service = {
    subscribe: signal.subscribe,
    read: () => Promise.resolve(stored),
    begin: () => Promise.resolve(RELEASE_IDS.event),
    edit: (id: string, quantity: string) => {
      assert.equal(id, stored.draft?.eventId);
      assert.ok(stored.draft);
      stored = { ...stored, draft: { ...stored.draft, quantity } };
      signal.emit();
      return Promise.resolve();
    },
    save: (_id: string, isCurrent?: () => boolean) => {
      assert.equal(isCurrent?.(), true);
      return Promise.resolve();
    },
    locate: (_id: string, isCurrent: () => boolean) => {
      assert.equal(isCurrent(), true);
      return Promise.resolve();
    },
    photo: (_id: string, isCurrent: () => boolean) => {
      assert.equal(isCurrent(), true);
      return Promise.resolve();
    },
    undoPhoto: () => Promise.resolve(),
  };
  const controller = new ReleaseEditorController({
    service,
    buffer,
    selection: { taskId: RELEASE_IDS.task, deviceId: RELEASE_IDS.device, manualCapture: false },
    identityKey: () => identity,
    isUnlocked: () => unlocked,
    refreshBundle: () => Promise.resolve(),
    subscribeAuth: auth.subscribe,
    subscribeScope: scope.subscribe,
    subscribeSync: notifications().subscribe,
  });
  return {
    controller,
    service,
    buffer,
    scope,
    getStored: () => stored,
    store: (state: ReleaseState) => {
      stored = state;
      signal.emit();
    },
    lock: () => {
      unlocked = false;
      auth.emit();
    },
    unlock: () => {
      unlocked = true;
      auth.emit();
    },
    replaceSession: () => {
      identity = "replacement-owner-session";
      auth.emit();
    },
  };
}
function editorIdle(controller: ReleaseEditorController): Promise<void> {
  if (!controller.getSnapshot().isBusy) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = controller.subscribe(() => {
      if (!controller.getSnapshot().isBusy) {
        stop();
        resolve();
      }
    });
  });
}
void test("raw release quantity keeps the latest keystroke through an older write and a failed local save", async () => {
  const buffer = new ReleaseEditBuffer(),
    first = deferred<undefined>(),
    started = deferred<undefined>();
  const state = editorState(),
    id = RELEASE_IDS.event;
  let shouldFail = true,
    storedQuantity = "";
  buffer.edit(id, "1", async () => {
    started.resolve(undefined);
    await first.promise;
    storedQuantity = "1";
  });
  const pending = buffer.persist(id);
  await started.promise;
  buffer.edit(id, "12.000001", () => {
    if (shouldFail) return Promise.reject(new Error("Injected local storage failure."));
    storedQuantity = "12.000001";
    return Promise.resolve();
  });
  first.resolve(undefined);
  await assert.rejects(pending, /Injected local storage failure/);
  assert.equal(buffer.merge(state).draft?.quantity, "12.000001");
  assert.equal(buffer.hasPending(id), true);
  shouldFail = false;
  await buffer.persist(id);
  assert.equal(storedQuantity, "12.000001");
  assert.equal(buffer.hasPending(id), false);
});
void test("camera continuation flushes quantity and survives same-session lock while genuine scope changes cancel adoption", async () => {
  const harness = editorHarness(),
    write = deferred<undefined>(),
    writeStarted = deferred<undefined>();
  const photo = deferred<undefined>(),
    photoStarted = deferred<undefined>(),
    photoDone = deferred<undefined>();
  harness.service.edit = async (id, quantity) => {
    assert.equal(id, RELEASE_IDS.event);
    writeStarted.resolve(undefined);
    await write.promise;
    const stored = harness.getStored();
    assert.ok(stored.draft);
    harness.store({ ...stored, draft: { ...stored.draft, quantity } });
  };
  harness.service.photo = async (_id, isCurrent) => {
    photoStarted.resolve(undefined);
    await photo.promise;
    assert.equal(
      isCurrent(),
      true,
      "an already launched camera retains its same-owner lease under local lock",
    );
    const stored = harness.getStored();
    assert.ok(stored.draft);
    harness.store({
      ...stored,
      draft: {
        ...stored.draft,
        evidence: [{ id: "photo-139", fileRef: "file:///private/photo.png" }],
      },
    });
    photoDone.resolve(undefined);
  };
  harness.controller.start();
  await harness.controller.load();
  harness.controller.editQuantity("25.000001");
  await writeStarted.promise;
  harness.controller.photo();
  assert.equal(harness.controller.getSnapshot().state?.draft?.quantity, "25.000001");
  write.resolve(undefined);
  await photoStarted.promise;
  assert.equal(
    harness.getStored().draft?.quantity,
    "25.000001",
    "physical work starts only after the exact raw edit is durable",
  );
  harness.lock();
  assert.equal(
    harness.controller.getSnapshot().state,
    null,
    "locked presentation hides the retained capture",
  );
  photo.resolve(undefined);
  await photoDone.promise;
  await editorIdle(harness.controller);
  assert.equal(harness.controller.getSnapshot().state, null);
  harness.unlock();
  await harness.controller.load();
  assert.equal(harness.controller.getSnapshot().state?.draft?.evidence.length, 1);
  harness.controller.stop();
  await cancelledPhotoAfterScopeChange();
});
async function cancelledPhotoAfterScopeChange() {
  const harness = editorHarness(),
    photo = deferred<undefined>(),
    started = deferred<undefined>(),
    done = deferred<undefined>();
  let adopted = false;
  harness.service.photo = async (_id, isCurrent) => {
    started.resolve(undefined);
    await photo.promise;
    adopted = isCurrent();
    done.resolve(undefined);
  };
  harness.controller.start();
  await harness.controller.load();
  harness.controller.photo();
  await started.promise;
  harness.store(editorState({ draft: null, ready: false, tasks: [], devices: [] }));
  harness.scope.emit();
  photo.resolve(undefined);
  await done.promise;
  await editorIdle(harness.controller);
  await harness.controller.load();
  assert.equal(adopted, false);
  assert.equal(harness.controller.getSnapshot().state?.draft, null);
  harness.controller.stop();
}
void test("an old release read cannot restore private references after replacement-session invalidation", async () => {
  const harness = editorHarness(),
    old = deferred<ReleaseState>();
  harness.controller.start();
  await harness.controller.load();
  harness.service.read = () => old.promise;
  const pending = harness.controller.load();
  harness.service.read = () =>
    Promise.resolve(editorState({ draft: null, ready: false, tasks: [], devices: [] }));
  harness.replaceSession();
  await harness.controller.load();
  old.resolve(editorState());
  await pending;
  assert.equal(harness.controller.getSnapshot().state?.draft, null);
  assert.deepEqual(harness.controller.getSnapshot().state?.devices, []);
  harness.controller.stop();
});
