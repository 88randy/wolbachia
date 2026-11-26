import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import type { SampleViewModel } from "../src/features/samples/view-model.ts";
import { SampleEditBuffer } from "../src/features/samples/edit-buffer.ts";
import { refreshSampleConfiguration } from "../src/features/samples/refresh-configuration.ts";
import { SampleEditorController } from "../src/features/samples/editor-controller.ts";
import type { SamplePatch, SampleState } from "../src/features/samples/types.ts";
import { deferred } from "./support/auth-fakes.ts";
import { componentHarness, minHeightOf } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

const FEATURE = "mobile/src/features/samples/";
const NO_ACTION = () => undefined;
const DEFAULT_OPTIONS = { locale: "es-MX", scheme: "light", fontScale: 1 } as const;
function model(patch: Partial<SampleViewModel> = {}): SampleViewModel {
  return {
    isLoading: false,
    isBusy: false,
    errorKey: null,
    hasDraft: true,
    canBegin: false,
    canEdit: true,
    canSave: true,
    hasPendingEdits: false,
    sources: [{ id: "lot:lot-139", label: "LOT-139" }],
    origins: [{ id: "other-origin", label: "Configured other origin" }],
    methods: [{ id: "method-139", label: "Named verified method" }],
    drafts: [],
    selectedSource: "lot:lot-139",
    selectedOrigin: "other-origin",
    selectedMethod: "method-139",
    sampleId: "sample-139",
    sourceId: "lot-139",
    sourceLabel: "LOT-139",
    sourceKindKey: "mobile.sample.sourceLot",
    methodLabel: "Named verified method",
    originLabel: "Configured other origin",
    code: "M-2207",
    otherText: "Recorded source detail",
    isOther: true,
    codeErrorKey: null,
    otherErrorKey: null,
    blockers: [],
    gpsAccuracy: 4,
    requiresPhoto: true,
    evidenceCount: 1,
    photoUri: "file:///private/sample.png",
    evidencePending: false,
    receiptAt: null,
    status: "draft",
    resultKey: null,
    reviewedKey: null,
    selectSource: NO_ACTION,
    selectOrigin: NO_ACTION,
    selectMethod: NO_ACTION,
    openDraft: NO_ACTION,
    changeCode: NO_ACTION,
    changeOtherText: NO_ACTION,
    blurFields: NO_ACTION,
    begin: NO_ACTION,
    acquireGps: NO_ACTION,
    capturePhoto: NO_ACTION,
    undoPhoto: NO_ACTION,
    save: NO_ACTION,
    retry: NO_ACTION,
    openInbox: NO_ACTION,
    backToDay: NO_ACTION,
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
  (node.props.onPress as () => void)();
}
const minTarget = minHeightOf;
const MATRIX = (["es-MX", "en"] as const).flatMap((locale) =>
  (["light", "dark"] as const).flatMap((scheme) =>
    [1, 1.3].map((fontScale) => ({ locale, scheme, fontScale })),
  ),
);
void test("P20 host matrix exposes genuine choices, raw fields, GPS/photo undo and named 56dp controls", () => {
  for (const options of MATRIX) checkCapture(options);
});
function checkCapture(options: (typeof MATRIX)[number]): void {
  const render = componentHarness(options).render,
    calls: string[] = [];
  const capture = model({
    changeCode: (value) => {
      calls.push(value);
    },
    changeOtherText: (value) => {
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
  const nodes = ["SampleFields", "SampleLocation", "SamplePhoto", "SampleFooter"].flatMap((name) =>
    render(`${FEATURE}${name}.tsx`, name, { model: capture }),
  );
  const fields = nodes.filter((node) => node.type === "TextInput");
  const refs = render(`${FEATURE}SampleReferences.tsx`, "SampleReferences", { model: capture });
  // The courier reads names, never internal ids.
  assert.ok(
    ["LOT-139", "Configured other origin", "Named verified method"].every((label) =>
      texts(refs).includes(label),
    ),
  );
  assert.ok(
    ["sample-139", "lot-139", "method-139", "other-origin"].every(
      (id) => !texts(refs).includes(id),
    ),
  );
  const [code, other] = fields;
  assert.ok(code);
  assert.ok(other);
  assert.equal(code.props.accessibilityLabel, messages[options.locale]["mobile.sample.code"]);
  assert.equal(code.props.value, "M-2207");
  assert.equal(other.props.value, "Recorded source detail");
  (code.props.onChangeText as (value: string) => void)("raw code ");
  (other.props.onChangeText as (value: string) => void)("raw detail ");
  presses(nodes).forEach(press);
  assert.deepEqual(calls, ["raw code ", "raw detail ", "gps", "photo", "undo", "save"]);
  assert.ok([...fields, ...presses(nodes)].every((node) => minTarget(node) >= 56));
  assert.ok(
    nodes
      .filter((node) => node.type === "Text")
      .every(
        (node) => node.props.numberOfLines === undefined && node.props.allowFontScaling !== false,
      ),
  );
}
void test("P20 pins its source after begin and shows only configured origin and verified method labels", () => {
  const render = componentHarness(DEFAULT_OPTIONS).render;
  const selection = render(`${FEATURE}SampleSelection.tsx`, "SampleSelection", { model: model() });
  assert.equal(presses(selection).length, 2);
  assert.ok(texts(selection).includes("Configured other origin"));
  assert.ok(texts(selection).includes("Named verified method"));
  assert.ok(!texts(selection).includes("LOT-139"));
  const basic = render(`${FEATURE}SampleFields.tsx`, "SampleFields", {
    model: model({ isOther: false, requiresPhoto: false }),
  });
  assert.equal(basic.filter((node) => node.type === "TextInput").length, 1);
});
void test("P20 cannot save with blockers, pending raw edits or an unavailable service", () => {
  const render = componentHarness(DEFAULT_OPTIONS).render;
  for (const patch of [
    { blockers: ["mobile.sample.methodRequired" as const] },
    { hasPendingEdits: true },
    { canSave: false },
    { isBusy: true },
  ]) {
    const footer = render(`${FEATURE}SampleFooter.tsx`, "SampleFooter", { model: model(patch) });
    assert.equal(presses(footer)[0]?.props.disabled, true);
  }
});
void test("P20 separates phone/server/review/rejection and preserves lab reminder until authentic receipt", () => {
  const render = componentHarness(DEFAULT_OPTIONS).render;
  const keyForStatus = {
    phone_saved: "mobile.sample.phoneSaved",
    server_received: "mobile.sample.serverReceived",
    in_review: "mobile.sample.inReview",
    critical_rejected: "mobile.sample.rejected",
  } as const;
  for (const status of Object.keys(keyForStatus) as (keyof typeof keyForStatus)[]) {
    const capture = model({ status, canEdit: false });
    const statusNodes = render(`${FEATURE}SampleStatus.tsx`, "SampleStatus", { model: capture });
    assert.ok(texts(statusNodes).includes(messages["es-MX"][keyForStatus[status]]));
    const reminder = render(`${FEATURE}SampleReminder.tsx`, "SampleReminder", { model: capture });
    assert.ok(texts(reminder).includes(messages["es-MX"]["mobile.sample.deliver"]));
    assert.equal(presses(reminder).length, 0);
  }
  const received = render(`${FEATURE}SampleReminder.tsx`, "SampleReminder", {
    model: model({ status: "server_received", receiptAt: "2026-11-10T18:00:00Z" }),
  });
  assert.ok(!texts(received).includes(messages["es-MX"]["mobile.sample.deliver"]));
  assert.ok(texts(received).includes(messages["es-MX"]["mobile.sample.received"]));
});
void test("P20 initial entry restores durable own work and unavailable sources explain recovery", () => {
  const render = componentHarness(DEFAULT_OPTIONS).render,
    calls: string[] = [];
  const capture = model({
    hasDraft: false,
    canEdit: false,
    sources: [],
    drafts: [{ id: "sample-139", label: "M-2207 · sample-139" }],
    openDraft: (id) => {
      calls.push(id);
    },
  });
  const source = render(`${FEATURE}SampleSelection.tsx`, "SampleSelection", { model: capture });
  assert.ok(texts(source).includes(messages["es-MX"]["mobile.sample.noSources"]));
  const work = render(`${FEATURE}SampleDrafts.tsx`, "SampleDrafts", { model: capture });
  press(presses(work)[0]);
  assert.deepEqual(calls, ["sample-139"]);
});

function sampleState(): SampleState {
  const source = {
    kind: "lot" as const,
    id: "lot-139",
    label: "LOT-139",
    center_id: "center-139",
    quadrant_id: null,
    author_id: null,
    event_id: null,
    device_time: null,
    created_at: "2026-11-09T18:00:00Z",
    effective: true,
    lot_version_id: "lot-version-139",
    lot_version_revision: 1,
    lot_version_created_at: "2026-11-09T18:00:00Z",
  };
  return {
    ready: true,
    canBegin: false,
    evidencePending: false,
    gates: [],
    review: null,
    receipt: null,
    sources: [source],
    origins: [],
    methods: [],
    work: [],
    event: null,
    draft: {
      sampleId: "sample-139",
      eventId: "event-139",
      ownerKey: "owner-139",
      shiftId: "shift-139",
      startedAt: "2026-11-10T18:00:00Z",
      deviceTime: "2026-11-10T18:00:00Z",
      timezone: "America/Mexico_City",
      manualCapture: false,
      sourceRef: { kind: "lot", id: source.id },
      source,
      captureVersion: "capture-139",
      catalogVersion: "catalog-139",
      rulesVersion: "rules-139",
      code: "M-2207",
      otherText: "",
      originCode: "",
      methodVersion: "",
      origin: null,
      method: null,
      gps: { lat: 19, lng: -99, accuracy_m: 4 },
      evidence: [],
    },
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
function editorFixture(
  refresh: (isCurrent: () => boolean) => Promise<void> = () => Promise.resolve(),
) {
  let state = sampleState(),
    identity = "owner-session-139",
    unlocked = true;
  const auth = notifications(),
    scope = notifications(),
    signal = notifications();
  const service = {
    read: () => Promise.resolve(state),
    begin: () => Promise.resolve("sample-new"),
    edit: (_id: string, patch: SamplePatch) => {
      assert.ok(state.draft);
      state = { ...state, draft: { ...state.draft, ...patch } };
      return Promise.resolve();
    },
    save: (_id: string, guard?: () => boolean) => {
      assert.equal(guard?.(), true);
      return Promise.resolve();
    },
    locate: (_id: string, guard: () => boolean) => {
      assert.equal(guard(), true);
      return Promise.resolve();
    },
    photo: (_id: string, guard: () => boolean) => {
      assert.equal(guard(), true);
      return Promise.resolve();
    },
    undoPhoto: () => Promise.resolve(),
    subscribe: signal.subscribe,
  };
  const buffer = new SampleEditBuffer();
  const controller = new SampleEditorController({
    service,
    buffer,
    selection: { sampleId: "sample-139", sourceRef: null, manualCapture: false },
    refreshBundle: refresh,
    identityKey: () => identity,
    isUnlocked: () => unlocked,
    subscribeScope: scope.subscribe,
    subscribeAuth: auth.subscribe,
    subscribeSync: signal.subscribe,
  });
  return {
    controller,
    service,
    buffer,
    scope,
    state: () => state,
    lock: () => {
      unlocked = false;
      auth.emit();
    },
    unlock: () => {
      unlocked = true;
      auth.emit();
    },
    replaceSession: () => {
      identity = "replacement-session";
      auth.emit();
    },
  };
}
function editorState(
  controller: SampleEditorController,
  predicate: (snapshot: ReturnType<SampleEditorController["getSnapshot"]>) => boolean,
): Promise<void> {
  if (predicate(controller.getSnapshot())) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = controller.subscribe(() => {
      if (predicate(controller.getSnapshot())) {
        stop();
        resolve();
      }
    });
  });
}
void test("sample raw buffer merges fields through an older write and retains failed edits", async () => {
  const buffer = new SampleEditBuffer(),
    started = deferred<undefined>(),
    finish = deferred<undefined>();
  const writes: SamplePatch[] = [];
  buffer.edit("sample-139", { code: "raw-first" }, async (patch) => {
    writes.push(patch);
    started.resolve(undefined);
    await finish.promise;
  });
  const pending = buffer.persist("sample-139");
  await started.promise;
  buffer.edit("sample-139", { code: "raw-latest ", otherText: "raw-detail " }, (patch) => {
    writes.push(patch);
    return Promise.reject(new Error("storage unavailable"));
  });
  finish.resolve(undefined);
  await assert.rejects(pending, /storage unavailable/);
  const visible = buffer.merge(sampleState()).draft;
  assert.ok(visible);
  assert.equal(visible.code, "raw-latest ");
  assert.equal(visible.otherText, "raw-detail ");
  assert.equal(buffer.hasPending("sample-139"), true);
  assert.deepEqual(writes, [
    { code: "raw-first" },
    { code: "raw-latest ", otherText: "raw-detail " },
  ]);
});
void test("sample photo flushes exact raw fields; an already launched camera survives same-session lock only", async () => {
  let launches = 0;
  const fixture = editorFixture(),
    writeStarted = deferred<undefined>(),
    write = deferred<undefined>();
  const cameraStarted = deferred<undefined>(),
    camera = deferred<undefined>(),
    adopted = deferred<boolean>();
  const edit = fixture.service.edit;
  fixture.service.edit = async (id, patch) => {
    writeStarted.resolve(undefined);
    await write.promise;
    await edit(id, patch);
  };
  fixture.service.photo = async (_id, guard) => {
    launches++;
    assert.equal(fixture.state().draft?.code, "latest raw ");
    cameraStarted.resolve(undefined);
    await camera.promise;
    adopted.resolve(guard());
  };
  fixture.controller.start();
  await editorState(fixture.controller, (snapshot) => snapshot.state !== null);
  fixture.controller.edit({ code: "latest raw " });
  await writeStarted.promise;
  fixture.controller.photo();
  assert.equal(fixture.controller.getSnapshot().isBusy, true);
  write.resolve(undefined);
  await cameraStarted.promise;
  fixture.lock();
  assert.equal(fixture.controller.getSnapshot().state, null);
  camera.resolve(undefined);
  assert.equal(await adopted.promise, true);
  await editorState(fixture.controller, (snapshot) => !snapshot.isBusy);
  fixture.controller.photo();
  assert.equal(launches, 1);
  fixture.unlock();
  await editorState(fixture.controller, (snapshot) => snapshot.state !== null);
  assert.equal(fixture.controller.getSnapshot().state?.draft?.code, "latest raw ");
  fixture.controller.stop();
});
void test("persisted raw sample edits stay unvalidated until a fresh gate read finishes", async () => {
  const fixture = editorFixture(),
    started = deferred<undefined>(),
    read = deferred<SampleState>();
  fixture.controller.start();
  await editorState(fixture.controller, (snapshot) => snapshot.state !== null);
  fixture.service.read = () => {
    started.resolve(undefined);
    return read.promise;
  };
  fixture.controller.edit({ code: "" });
  await started.promise;
  assert.equal(fixture.controller.hasPending(), false);
  assert.equal(fixture.controller.getSnapshot().isValidating, true);
  read.resolve({ ...fixture.state(), gates: ["code"] });
  await editorState(
    fixture.controller,
    (snapshot) => snapshot.state?.gates.includes("code") === true,
  );
  assert.equal(fixture.controller.getSnapshot().isValidating, false);
  fixture.controller.stop();
});
void test("explicit sample recovery upgrades the legacy catalog before a forced current bootstrap", async () => {
  let hasSampleOrigins = false;
  const calls: string[] = [];
  await refreshSampleConfiguration(
    {
      refreshCatalog: () => {
        calls.push("catalog");
        hasSampleOrigins = true;
        return Promise.resolve();
      },
      refreshBootstrap: (force) => {
        assert.equal(hasSampleOrigins, true);
        assert.equal(force, true);
        calls.push("bootstrap");
        return Promise.resolve();
      },
    },
    () => true,
  );
  assert.deepEqual(calls, ["catalog", "bootstrap"]);
});
void test("a stale or locked sample recovery never starts a later bootstrap request", async () => {
  const started = deferred<undefined>(),
    catalog = deferred<undefined>();
  let isCurrent = true,
    requests = 0;
  const deps = {
    refreshCatalog: () => {
      requests++;
      started.resolve(undefined);
      return catalog.promise;
    },
    refreshBootstrap: () => {
      requests++;
      return Promise.resolve();
    },
  };
  const recovery = refreshSampleConfiguration(deps, () => isCurrent);
  await started.promise;
  isCurrent = false;
  catalog.resolve(undefined);
  await recovery;
  assert.equal(requests, 1);
  await refreshSampleConfiguration(deps, () => false);
  assert.equal(requests, 1);
});
void test("sample configuration refresh is reachable without an exception or available metadata", () => {
  const render = componentHarness(DEFAULT_OPTIONS).render;
  let refreshes = 0;
  const feedback = render(`${FEATURE}SampleFeedback.tsx`, "SampleFeedback", {
    model: model({
      errorKey: null,
      hasDraft: false,
      canEdit: false,
      sources: [],
      origins: [],
      methods: [],
      retry: () => {
        refreshes++;
      },
    }),
  });
  assert.ok(texts(feedback).includes(messages["es-MX"]["mobile.sample.refresh"]));
  assert.equal(presses(feedback)[0]?.props.disabled, false);
  press(presses(feedback)[0]);
  assert.equal(refreshes, 1);
});
void test("sample configuration refresh flushes original raw fields and never requests network after storage failure", async () => {
  let requests = 0,
    shouldFail = true;
  const fixture = editorFixture((isCurrent) => {
    assert.equal(isCurrent(), true);
    assert.equal(fixture.state().draft?.sampleId, "sample-139");
    assert.equal(fixture.state().draft?.code, "latest code ");
    assert.equal(fixture.state().draft?.otherText, "latest detail ");
    requests++;
    return Promise.resolve();
  });
  const edit = fixture.service.edit;
  fixture.service.edit = (id, patch) =>
    shouldFail ? Promise.reject(new Error("storage unavailable")) : edit(id, patch);
  fixture.controller.start();
  await editorState(fixture.controller, (snapshot) => snapshot.state !== null);
  fixture.controller.edit({ code: "latest code ", otherText: "latest detail " });
  await editorState(fixture.controller, (snapshot) => snapshot.errorKey !== null);
  fixture.controller.retry();
  await editorState(fixture.controller, (snapshot) => !snapshot.isBusy);
  assert.equal(requests, 0);
  assert.equal(fixture.controller.getSnapshot().state?.draft?.code, "latest code ");
  assert.equal(fixture.controller.hasPending(), true);
  shouldFail = false;
  fixture.controller.retry();
  await editorState(fixture.controller, (snapshot) => !snapshot.isBusy);
  assert.equal(requests, 1);
  fixture.controller.stop();
});
void test("a replaced sample session cancels camera continuation and older reads never publish", async () => {
  const fixture = editorFixture(),
    started = deferred<undefined>(),
    camera = deferred<undefined>();
  const adopted = deferred<boolean>();
  fixture.service.photo = async (_id, guard) => {
    started.resolve(undefined);
    await camera.promise;
    adopted.resolve(guard());
  };
  fixture.controller.start();
  await editorState(fixture.controller, (snapshot) => snapshot.state !== null);
  fixture.controller.photo();
  await started.promise;
  fixture.replaceSession();
  camera.resolve(undefined);
  assert.equal(await adopted.promise, false);
  await editorState(fixture.controller, (snapshot) => !snapshot.isBusy);
  const older = deferred<SampleState>(),
    current = { ...sampleState(), draft: null };
  fixture.service.read = () => older.promise;
  const pending = fixture.controller.load();
  fixture.service.read = () => Promise.resolve(current);
  fixture.scope.emit();
  await editorState(fixture.controller, (snapshot) => snapshot.state?.draft === null);
  older.resolve(sampleState());
  await pending;
  assert.equal(fixture.controller.getSnapshot().state?.draft, null);
  fixture.controller.stop();
});
