import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import { RELEASE_GATE_NAMES } from "../src/features/releases/view-model.ts";
import type { ReleaseViewModel } from "../src/features/releases/view-model.ts";
import { ReleaseEditBuffer } from "../src/features/releases/edit-buffer.ts";
import { ReleaseEditorController } from "../src/features/releases/editor-controller.ts";
import type { ReleaseState } from "../src/features/releases/types.ts";
import { releaseDraft, releaseEnvelope, RELEASE_IDS } from "./support/release-fixtures.ts";
import { deferred } from "./support/auth-fakes.ts";
import { componentHarness, flattenStyle, minHeightOf } from "./support/m-09-render.ts";
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
    canRestart: false,
    hasPendingEdits: false,
    selectTask: NO_ACTION,
    selectDevice: NO_ACTION,
    begin: NO_ACTION,
    restart: NO_ACTION,
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
const minTarget = minHeightOf;
function byLabel(nodes: readonly RenderNode[], label: string): RenderNode | undefined {
  return nodes.find((node) => node.props.accessibilityLabel === label);
}
const MATRIX = (["es-MX", "en"] as const).flatMap((locale) =>
  (["light", "dark"] as const).flatMap((scheme) =>
    [1, 1.3].map((fontScale) => ({ locale, scheme, fontScale })),
  ),
);

void test("P18 host matrix keeps the sachet counter, GPS, photo undo and the Save button reachable", () => {
  for (const options of MATRIX) {
    const t = messages[options.locale];
    const render = componentHarness(options).render;
    const calls: string[] = [];
    const capture = model({
      quantity: "3",
      changeQuantity: (value) => {
        calls.push(`quantity:${value}`);
      },
      blurQuantity: () => {
        calls.push("blur");
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
    const label = t["courier.flow.release.sachets"];
    assert.ok(texts(form).includes("3"), "the counter shows the whole sachets");
    const plus = byLabel(form, t["courier.counter.increase"].replace("{label}", label));
    assert.ok(plus);
    press(plus);
    press(byLabel(form, t["mobile.release.acquireGps"]));
    const photo = render(`${FEATURE}ReleaseEvidence.tsx`, "ReleaseEvidence", { model: capture });
    assert.equal(
      photo.find((node) => node.type === "Image")?.props.accessibilityLabel,
      t["mobile.release.photoPreview"],
    );
    press(byLabel(photo, t["mobile.release.capturePhoto"]));
    press(byLabel(photo, t["mobile.release.undoPhoto"]));
    const footer = render(`${FEATURE}ReleaseFooter.tsx`, "ReleaseFooter", { model: capture });
    const save = byLabel(footer, t["courier.flow.release.done"]);
    assert.ok(save);
    assert.equal(save.props.disabled, false);
    assert.ok(minTarget(save) >= 48);
    press(save);
    assert.deepEqual(calls, ["quantity:4", "blur", "gps", "photo", "undo", "save"]);
    checkScaling([...form, ...photo, ...footer]);
  }
});
function checkScaling(nodes: readonly RenderNode[]): void {
  for (const node of nodes.filter((node) => node.type === "Text")) {
    assert.equal(node.props.numberOfLines, undefined);
    assert.notEqual(node.props.allowFontScaling, false);
    assert.ok(Number(flattenStyle(node.props.style).fontSize) >= 12);
  }
}

void test("P19 blocks every missing or failed prerequisite: no Save at all, only the way to report it", () => {
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
  const t = messages[locale];
  const footer = render(`${FEATURE}ReleaseFooter.tsx`, "ReleaseFooter", { model: capture });
  // A stale caller may still say canSave: the footer offers no Save when a gate is not met.
  assert.equal(byLabel(footer, t["courier.flow.release.done"]), undefined);
  assert.ok(byLabel(footer, t["mobile.release.reportSupervisor"]));
  assert.ok(byLabel(footer, t["mobile.release.reportDevice"]));
  const gates = render(`${FEATURE}ReleaseGates.tsx`, "ReleaseGates", { gates: capture.gates });
  assert.ok(texts(gates).includes(t["courier.flow.release.blockedTitle"]));
  const blocked = gates.filter(
    (node) => typeof node.props.accessibilityLabel === "string" && node.props.accessible === true,
  );
  assert.equal(blocked.length, RELEASE_GATE_NAMES.length);
  assert.ok(texts(gates).some((text) => String(text).includes(t["mobile.release.contactSupervisor"])));
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

void test("P18 local read failure keeps retry and all partial blockers visible and the counter inert", () => {
  const render = componentHarness({ locale: "en", scheme: "dark", fontScale: 1.3 }).render;
  const loading = render(`${FEATURE}ReleaseContent.tsx`, "ReleaseContent", {
    model: model({ isLoading: true }),
  });
  assert.ok(texts(loading).includes(messages.en["mobile.release.loading"]));
  assert.equal(
    loading.some((node) => node.type === "ActivityIndicator"),
    false,
  );
  assert.equal(presses(loading).length, 0);
  const calls: string[] = [];
  const unavailable = model({
    errorKey: "mobile.release.detailContractUnavailable",
    gates: [],
    canEdit: false,
    canSave: false,
    changeQuantity: () => {
      calls.push("quantity");
    },
    retry: () => {
      calls.push("retry");
    },
  });
  const partial = render(`${FEATURE}ReleaseContent.tsx`, "ReleaseContent", { model: unavailable });
  assert.ok(texts(partial).includes(messages.en["mobile.release.detailContractUnavailable"]));
  assert.ok(texts(partial).includes(messages.en["mobile.release.gateLot"]));
  assert.ok(texts(partial).includes(messages.en["mobile.release.gateDevice"]));
  press(byLabel(partial, messages.en["common.actions.retry"]));
  const plus = partial.find((node) =>
    String(node.props.accessibilityLabel).startsWith(
      messages.en["courier.counter.increase"].replace("{label}", ""),
    ),
  );
  press(plus);
  assert.deepEqual(calls, ["retry"], "an uneditable capture ignores the counter");
});

void test("P18 chooses exact downloaded task/device identities and prepares only an explicit complete selection", () => {
  const render = componentHarness({ locale: "en", scheme: "light", fontScale: 1.3 }).render;
  const selected: string[] = [];
  const capture = model({
    hasDraft: false,
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
  const radios = options.filter((node) => node.props.accessibilityRole === "radio");
  assert.deepEqual(
    radios.map((node) => node.props.accessibilityLabel),
    ["TASK-139", "DEV-139"],
  );
  assert.ok(radios.every((node) => node.props.disabled === false && minTarget(node) >= 48));
  for (const radio of radios) press(radio);
  assert.deepEqual(selected, ["task-139", "device-139"]);
  const frozen = render(`${FEATURE}ReleaseChoices.tsx`, "ReleaseChoices", {
    model: { ...capture, hasDraft: true },
  });
  assert.equal(
    presses(frozen).length,
    0,
    "original task/device choices cannot change after a draft exists",
  );
  const begin = render(`${FEATURE}ReleaseBegin.tsx`, "ReleaseBegin", {
    model: { ...capture, hasDraft: false, canBegin: false },
  });
  assert.equal(byLabel(begin, messages.en["mobile.release.begin"])?.props.disabled, true);
  // Without a draft the footer's Save is unavailable as well: blocked gates offer only reporting.
  const footer = render(`${FEATURE}ReleaseFooter.tsx`, "ReleaseFooter", { model: capture });
  assert.equal(byLabel(footer, messages.en["courier.flow.release.done"]), undefined);
});

function editorState(patch: Partial<ReleaseState> = {}): ReleaseState {
  return {
    draft: releaseDraft(),
    event: null,
    ready: true,
    canRestart: false,
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
    restart: () => Promise.resolve("10000000-0000-4000-8000-000000000239"),
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

void test("fresh-draft recovery flushes raw input, changes active UUID and fences old camera callbacks without restarting saved events", async () => {
  const harness = editorHarness(),
    write = deferred<undefined>(),
    started = deferred<undefined>();
  let cameraLease: () => boolean = () => false;
  harness.store(editorState({ canRestart: true }));
  harness.service.photo = (_id, isCurrent) => {
    cameraLease = isCurrent;
    return Promise.resolve();
  };
  harness.service.edit = async (_id, quantity) => {
    started.resolve(undefined);
    await write.promise;
    const state = harness.getStored();
    assert.ok(state.draft);
    harness.store({ ...state, draft: { ...state.draft, quantity } });
  };
  let restarted = 0;
  harness.service.restart = () => {
    const state = harness.getStored();
    assert.ok(state.draft);
    assert.equal(state.draft.quantity, "32.000001");
    restarted++;
    const fresh = {
      ...state.draft,
      eventId: "10000000-0000-4000-8000-000000000239",
      gps: null,
      evidence: [],
    };
    harness.store({ ...state, draft: fresh, canRestart: false });
    return Promise.resolve(fresh.eventId);
  };
  harness.controller.start();
  await harness.controller.load();
  harness.controller.photo();
  await editorIdle(harness.controller);
  assert.equal(cameraLease(), true);
  harness.controller.editQuantity("32.000001");
  await started.promise;
  harness.controller.restart();
  assert.equal(restarted, 0);
  write.resolve(undefined);
  await editorIdle(harness.controller);
  assert.equal(restarted, 1);
  assert.equal(
    harness.controller.getSnapshot().state?.draft?.eventId,
    "10000000-0000-4000-8000-000000000239",
  );
  assert.equal(harness.controller.getSnapshot().state?.draft?.quantity, "32.000001");
  assert.equal(cameraLease(), false, "the old camera lease cannot attach to the fresh origin");
  const fresh = harness.getStored().draft;
  assert.ok(fresh);
  harness.store(
    editorState({
      draft: fresh,
      canRestart: true,
      event: {
        seq: 1,
        status: "pending",
        attempts: 0,
        lastError: null,
        result: null,
        envelope: releaseEnvelope(fresh),
      },
    }),
  );
  await harness.controller.load();
  harness.controller.restart();
  assert.equal(restarted, 1, "a saved original event never becomes a new draft");
  const render = componentHarness({ locale: "es-MX", scheme: "dark", fontScale: 1.3 }).render;
  const control = render(`${FEATURE}ReleaseRestart.tsx`, "ReleaseRestart", {
    model: model({ canRestart: true }),
  });
  assert.ok(texts(control).includes(messages["es-MX"]["mobile.release.restartHint"]));
  assert.equal(presses(control).length, 1);
  const saved = render(`${FEATURE}ReleaseRestart.tsx`, "ReleaseRestart", {
    model: model({ canRestart: true, status: "phone_saved" }),
  });
  assert.equal(presses(saved).length, 0);
  harness.controller.stop();
});
