import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import type { IncidentDraft, IncidentState } from "../src/features/incidents/types.ts";
import type { OutboxEvent } from "../src/outbox/outbox-event.ts";
import type { OutboxStatus } from "../src/outbox/outbox-status.ts";
import { IncidentEditBuffer, incidentEditBuffer } from "../src/features/incidents/edit-buffer.ts";
import { componentHarness, flattenStyle } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

const FEATURE = "mobile/src/features/incidents/";
const TYPE: Schemas["IncidentType"] = {
  id: "10000000-0000-4000-8000-000000000001",
  current_version_id: "10000000-0000-4000-8000-000000000002",
  revision: 1,
  code: "other",
  label: "Synthetic Other",
  icon: "alert",
  is_other: true,
  is_active: true,
  severity: "high",
  supervisor: null,
  coordinator: null,
  terminal: "10000000-0000-4000-8000-000000000003",
  supervisor_display: null,
  coordinator_display: null,
  terminal_display: null,
  supervisor_sla_seconds: 30,
  coordinator_sla_seconds: 60,
  report_evidence_min: 1,
  close_evidence_min: 1,
  blocker_kinds: [],
};
const DRAFT: IncidentDraft = {
  eventId: "10000000-0000-4000-8000-000000000141",
  ownerKey: "synthetic-owner",
  kind: "report",
  shiftId: "10000000-0000-4000-8000-000000000142",
  deviceTime: "2026-11-09T12:00:00Z",
  catalogVersion: "catalog",
  rulesVersion: "rules",
  description: "Synthetic capture",
  type: TYPE,
  evidence: [
    { id: "10000000-0000-4000-8000-000000000143", fileRef: "file:///private/incident.png" },
  ],
  gps: null,
};
function state(patch: Partial<IncidentState> = {}): IncidentState {
  return {
    ready: true,
    canBegin: true,
    canUpload: true,
    canRead: true,
    draft: DRAFT,
    drafts: [DRAFT],
    event: null,
    evidencePending: false,
    types: [TYPE],
    incidents: [],
    supportContact: "+525550000000",
    ...patch,
  };
}
function event(status: OutboxStatus): OutboxEvent {
  return {
    seq: 1,
    status,
    attempts: 0,
    lastError: null,
    result: null,
    envelope: {
      id: DRAFT.eventId,
      type: "incident.report",
      schema_version: 1,
      device_time: DRAFT.deviceTime,
      payload: {},
      shift_id: DRAFT.shiftId,
      rules_version: DRAFT.rulesVersion,
      catalog_version: DRAFT.catalogVersion,
      manual_capture: true,
    },
  };
}
function texts(nodes: readonly RenderNode[]) {
  return nodes.filter((node) => node.type === "Text").map((node) => node.props.children);
}
function press(node: RenderNode | undefined) {
  assert.ok(node);
  assert.equal(node.props.disabled, false);
  assert.equal(typeof node.props.onPress, "function");
  (node.props.onPress as () => void)();
}
function targetHeight(node: RenderNode): number {
  const style =
    typeof node.props.style === "function"
      ? (node.props.style as (input: { pressed: boolean }) => unknown)({ pressed: false })
      : node.props.style;
  return Number(flattenStyle(style).minHeight);
}

void test("P23 host matrix preserves Other details, photo Undo and bottom Save at 130 percent", () => {
  for (const locale of ["es-MX", "en"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const render = componentHarness({ locale, scheme, fontScale: 1.3 }).render;
      let description = "",
        photos = 0,
        undo = 0,
        saved = 0;
      const model = {
        state: state(),
        isBusy: false,
        submittedId: null,
        editDescription: (value: string) => {
          description = value;
        },
        run: (operation: () => Promise<void>) => operation(),
        service: {
          photo: () => {
            photos++;
            return Promise.resolve();
          },
          undoPhoto: () => {
            undo++;
            return Promise.resolve();
          },
        },
        save: () => {
          saved++;
        },
      };
      const form = render(`${FEATURE}IncidentForm.tsx`, "IncidentForm", { model });
      const input = form.find((node) => node.type === "TextInput");
      assert.equal(
        input?.props.accessibilityLabel,
        messages[locale]["mobile.incidents.description"],
      );
      assert.equal(input.props.value, DRAFT.description);
      assert.equal(input.props.editable, true);
      (input.props.onChangeText as (value: string) => void)("raw input retained");
      assert.equal(description, "raw input retained");
      assert.ok(texts(form).includes(messages[locale]["mobile.incidents.otherHint"]));
      assert.ok(
        form.some(
          (node) =>
            node.type === "Image" &&
            node.props.accessibilityLabel === messages[locale]["mobile.incidents.photoPreview"],
        ),
      );
      const actions = form.filter((node) => node.type === "Pressable");
      press(actions[actions.length - 2]);
      press(actions[actions.length - 1]);
      assert.equal(photos, 1);
      assert.equal(undo, 1);
      const footer = render(`${FEATURE}IncidentFooter.tsx`, "IncidentFooter", {
        model,
        kind: "report",
      });
      const save = footer.find((node) => node.type === "Pressable");
      assert.ok(save && targetHeight(save) >= 48);
      press(save);
      assert.equal(saved, 1);
      form
        .filter((node) => node.type === "Text")
        .forEach((node) => {
          assert.equal(node.props.numberOfLines, undefined);
          assert.notEqual(node.props.allowFontScaling, false);
          assert.ok(Number(flattenStyle(node.props.style).fontSize) >= 12);
        });
    }
});

void test("P23 keeps phone-saved, server-received and review outcomes separate from evidence and supervisor delivery", () => {
  for (const locale of ["es-MX", "en"] as const) {
    const render = componentHarness({ locale, scheme: "dark", fontScale: 1.3 }).render;
    for (const status of [
      "pending",
      "sending",
      "error",
      "sent",
      "in_review",
      "rejected",
    ] as const) {
      const rendered = texts(
        render(`${FEATURE}IncidentStatus.tsx`, "IncidentStatus", {
          state: state({ event: event(status), evidencePending: true }),
        }),
      );
      const key =
        status === "sent"
          ? "mobile.incidents.serverReceived"
          : status === "in_review"
            ? "mobile.incidents.reviewPending"
            : status === "rejected"
              ? "mobile.incidents.rejected"
              : "mobile.incidents.saved";
      assert.ok(rendered.includes(messages[locale][key]));
      assert.ok(rendered.includes(messages[locale]["mobile.incidents.evidencePending"]));
      assert.ok(rendered.includes(messages[locale]["mobile.incidents.noDeliveryPromise"]));
      assert.equal(
        rendered.includes(messages[locale]["mobile.incidents.serverReceived"]),
        status === "sent",
      );
    }
  }
});

void test("P24 exposes a large configured work-call action and preserves fallback plus safe closure after local Save", () => {
  for (const locale of ["es-MX", "en"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const render = componentHarness({ locale, scheme, fontScale: 1.3 }).render;
      let calls = 0,
        closes = 0;
      const accident = { ...DRAFT, kind: "accident" as const, description: "", type: null };
      const model = {
        state: state({ draft: accident }),
        isBusy: false,
        dialOutcome: "unavailable",
        call: () => {
          calls++;
        },
      };
      const contact = render(`${FEATURE}EmergencyContact.tsx`, "EmergencyContact", { model });
      const action = contact.find((node) => node.type === "Pressable");
      assert.ok(action && targetHeight(action) >= 48);
      press(action);
      assert.equal(calls, 1);
      assert.ok(texts(contact).includes(messages[locale]["mobile.incidents.dialerUnavailable"]));
      assert.ok(texts(contact).includes(messages[locale]["mobile.incidents.callFallback"]));
      const missing = render(`${FEATURE}EmergencyContact.tsx`, "EmergencyContact", {
        model: { ...model, state: state({ supportContact: null }) },
      });
      assert.equal(missing.find((node) => node.type === "Pressable")?.props.disabled, true);
      assert.ok(texts(missing).includes(messages[locale]["mobile.incidents.contactMissing"]));
      const closeShift = () => {
        closes++;
      };
      const before = render(`${FEATURE}IncidentFooter.tsx`, "IncidentFooter", {
        model,
        kind: "accident",
        closeShift,
      });
      assert.ok(!texts(before).includes(messages[locale]["mobile.incidents.safeClose"]));
      const after = render(`${FEATURE}IncidentFooter.tsx`, "IncidentFooter", {
        model: { ...model, state: state({ draft: accident, event: event("pending") }) },
        kind: "accident",
        closeShift,
      });
      press(after.filter((node) => node.type === "Pressable").at(-1));
      assert.equal(closes, 1);
    }
});

void test("P23 type search uses configured labels and keeps Other last without inventing choices", () => {
  const render = componentHarness({ locale: "en", scheme: "light", fontScale: 1.3 }).render;
  const regular = {
    ...TYPE,
    current_version_id: "regular-version",
    label: "Synthetic unsafe area",
    is_other: false,
  };
  const props = {
    types: [TYPE, regular],
    selected: TYPE.current_version_id,
    query: "",
    onQuery: () => undefined,
    choose: () => undefined,
  };
  const options = render(`${FEATURE}IncidentTypeOptions.tsx`, "IncidentTypeOptions", props);
  assert.deepEqual(
    options
      .filter((node) => node.type === "Pressable")
      .map((node) => node.props.accessibilityLabel),
    [regular.label, TYPE.label],
  );
  const empty = render(`${FEATURE}IncidentTypeOptions.tsx`, "IncidentTypeOptions", {
    ...props,
    query: "no match",
  });
  assert.ok(texts(empty).includes(messages.en["mobile.incidents.noTypeMatches"]));
});

void test("P23 persistent editor buffer retains failed raw text across remount and blocks Save until retry succeeds", async () => {
  const service = {},
    buffer = incidentEditBuffer(service);
  assert.ok(buffer instanceof IncidentEditBuffer);
  let shouldFail = true,
    writes = 0;
  buffer.edit("description", {
    eventId: DRAFT.eventId,
    apply: (draft) => ({ ...draft, description: "new raw details" }),
    write: () => {
      writes++;
      return shouldFail ? Promise.reject(new Error("storage failed")) : Promise.resolve();
    },
  });
  await assert.rejects(buffer.persist(DRAFT.eventId), /storage failed/);
  const restored = incidentEditBuffer(service);
  assert.equal(restored.merge(state()).draft?.description, "new raw details");
  assert.equal(restored.hasPendingFor(DRAFT.eventId), true);
  shouldFail = false;
  await restored.persist(DRAFT.eventId);
  assert.equal(restored.hasPendingFor(DRAFT.eventId), false);
  assert.equal(writes, 2);
});

void test("P24 local-lock fallback exposes only a call and never a capture action", () => {
  for (const locale of ["es-MX", "en"] as const) {
    const render = componentHarness({ locale, scheme: "dark", fontScale: 1.3 }).render;
    let calls = 0;
    const nodes = render(`${FEATURE}LockedCallAction.tsx`, "LockedCallAction", {
      outcome: "missing",
      call: () => {
        calls++;
      },
    });
    const actions = nodes.filter((node) => node.type === "Pressable");
    assert.equal(actions.length, 1);
    assert.ok(actions[0] && targetHeight(actions[0]) >= 48);
    press(actions[0]);
    assert.equal(calls, 1);
    assert.ok(texts(nodes).includes(messages[locale]["mobile.incidents.contactMissing"]));
    assert.equal(
      nodes.some((node) => node.type === "TextInput" || node.type === "Image"),
      false,
    );
  }
});

void test("P24 retains an old-shift draft while the current shift can start a new accident", () => {
  const render = componentHarness({ locale: "en", scheme: "light", fontScale: 1.3 }).render;
  let recovered = 0,
    begin = "";
  const model = {
    state: state({ ready: false, canBegin: true }),
    isBusy: false,
    recover: (operation: () => Promise<void>) => {
      recovered++;
      return operation();
    },
    service: {
      begin: (kind: string) => {
        begin = kind;
        return Promise.resolve();
      },
    },
  };
  const nodes = render(`${FEATURE}IncidentFooter.tsx`, "IncidentFooter", {
    model,
    kind: "accident",
  });
  press(nodes.find((node) => node.type === "Pressable"));
  assert.equal(recovered, 1);
  assert.equal(begin, "accident");
  assert.equal(model.state.draft?.eventId, DRAFT.eventId);
});

void test("P23 displays the actual supervisor comment while preserving its author and unknown-author redaction", () => {
  const render = componentHarness({ locale: "en", scheme: "dark", fontScale: 1.3 }).render;
  const incident = {
    description: "Synthetic report",
    timeline: [
      {
        id: "comment-1",
        action: "comment",
        created_at: "2026-11-09T14:00:00Z",
        author_display: "Synthetic supervisor",
        text: "Wait in a safe place.",
      },
      {
        id: "comment-2",
        action: "comment",
        created_at: "2026-11-09T14:01:00Z",
        author_display: null,
        text: "Synthetic redacted reply",
      },
    ],
  };
  const nodes = texts(render(`${FEATURE}IncidentThread.tsx`, "IncidentThread", { incident }));
  assert.ok(nodes.includes("Synthetic supervisor"));
  assert.ok(nodes.includes("Wait in a safe place."));
  assert.ok(nodes.includes(messages.en["incidents.workspace.unavailable"]));
  assert.ok(!nodes.includes(messages.en["incidents.workspace.system"]));
});
