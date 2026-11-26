import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import type { Locale, MessageKey } from "@wolbachia/i18n";
import type { FuelDraft, FuelState } from "../src/features/fuel/types.ts";
import type { OutboxStatus } from "../src/outbox/outbox-status.ts";
import type { OutboxEvent } from "../src/outbox/outbox-event.ts";
import { REVIEW_HISTORY } from "./support/lifecycle-contract-fixtures.ts";
import { componentHarness, flattenStyle, minHeightOf } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

const FEATURE = "mobile/src/features/fuel/";
const DRAFT: FuelDraft = {
  eventId: "10000000-0000-4000-8000-000000000140",
  ownerKey: "synthetic-owner",
  shiftId: "10000000-0000-4000-8000-000000000141",
  motorcycleCode: "M-140",
  deviceTime: "2026-11-09T12:00:00Z",
  catalogVersion: "catalog-fuel",
  rulesVersion: "rules-fuel",
  litres: "4.500",
  amount: "108.00",
  currency: "MXN",
  odometer: "12512",
  isFullRefill: false,
  receipt: { id: "10000000-0000-4000-8000-000000000142", fileRef: "file:///private/receipt.png" },
};
function event(status: OutboxStatus): OutboxEvent {
  return {
    seq: 1,
    status,
    attempts: 0,
    lastError: null,
    result: null,
    envelope: {
      id: DRAFT.eventId,
      type: "fuel.load",
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
function state(patch: Partial<FuelState> = {}): FuelState {
  return {
    ready: true,
    canBegin: true,
    draft: DRAFT,
    drafts: [DRAFT],
    event: null,
    receiptPending: true,
    review: null,
    advisory: { kind: "insufficient", efficiencyKmL: null, minimum: null, maximum: null },
    ...patch,
  };
}
function texts(nodes: readonly RenderNode[]) {
  return nodes.filter((node) => node.type === "Text").map((node) => node.props.children);
}
/** A notice may append the reviewer's reason after the outcome text. */
function hasNotice(list: readonly unknown[], text: string): boolean {
  return list.some((item) => item === text || String(item).startsWith(`${text} `));
}
function press(node: RenderNode | undefined): void {
  assert.ok(node);
  assert.equal(typeof node.props.onPress, "function");
  (node.props.onPress as () => void)();
}
const minTarget = minHeightOf;
function checkTextScaling(nodes: readonly RenderNode[]): void {
  for (const node of nodes.filter((node) => node.type === "Text")) {
    assert.equal(node.props.numberOfLines, undefined);
    assert.notEqual(node.props.allowFontScaling, false);
    assert.ok(Number(flattenStyle(node.props.style).fontSize) >= 12);
  }
}

void test("P22 host matrix keeps fixed motorcycle, units, numeric fields, retake and bottom action accessible at 130 percent", () => {
  for (const locale of ["es-MX", "en"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const render = componentHarness({ locale, scheme, fontScale: 1.3 }).render;
      const edits: [string, string | boolean][] = [],
        photos: string[] = [];
      let saves = 0;
      const model = {
        state: state(),
        isBusy: false,
        submittedId: null,
        edit: (field: string, value: string | boolean) => {
          edits.push([field, value]);
        },
        run: (operation: () => Promise<void>) => operation(),
        service: {
          photo: (id: string) => {
            photos.push(id);
            return Promise.resolve();
          },
        },
        save: () => {
          saves++;
        },
      };
      const form = render(`${FEATURE}FuelForm.tsx`, "FuelForm", { model });
      checkTextScaling(form);
      checkForm(locale, form);
      const [litres] = form.filter((node) => node.type === "TextInput");
      assert.ok(litres);
      (litres.props.onChangeText as (value: string) => void)("NaN");
      assert.deepEqual(edits[0], ["litres", "NaN"], "invalid raw input stays in the editor");
      assert.ok(texts(form).includes(messages[locale]["mobile.fuel.fullRefill"]));
      const [no, yes] = [
        form.find(
          (node) => node.props.accessibilityLabel === messages[locale]["courier.choice.no"],
        ),
        form.find(
          (node) => node.props.accessibilityLabel === messages[locale]["courier.choice.yes"],
        ),
      ];
      assert.ok(no && yes);
      assert.equal(no.props.accessibilityRole, "radio");
      assert.equal((no.props.accessibilityState as { checked: boolean }).checked, true);
      assert.equal((yes.props.accessibilityState as { checked: boolean }).checked, false);
      assert.ok(minTarget(yes) >= 48);
      press(yes);
      assert.deepEqual(edits[1], ["isFullRefill", true]);
      const receipt = render(`${FEATURE}FuelReceipt.tsx`, "FuelReceipt", { model });
      const image = receipt.find((node) => node.type === "Image");
      assert.ok(image);
      assert.ok(DRAFT.receipt);
      assert.equal(image.props.accessibilityLabel, messages[locale]["mobile.fuel.receiptPreview"]);
      assert.equal((image.props.source as { uri: string }).uri, DRAFT.receipt.fileRef);
      assert.ok(texts(receipt).includes(messages[locale]["mobile.fuel.retake"]));
      press(receipt.find((node) => node.type === "Pressable"));
      assert.deepEqual(photos, [DRAFT.eventId]);
      const footer = render(`${FEATURE}FuelFooter.tsx`, "FuelFooter", { model });
      const save = footer.find((node) => node.type === "Pressable");
      assert.ok(save);
      assert.ok(minTarget(save) >= 48);
      assert.equal(save.props.disabled, false);
      press(save);
      assert.equal(saves, 1);
    }
  }
});
function checkForm(locale: Locale, nodes: readonly RenderNode[]) {
  const inputs = nodes.filter((node) => node.type === "TextInput");
  assert.deepEqual(
    inputs.map((node) => node.props.accessibilityLabel),
    [
      messages[locale]["mobile.fuel.litres"],
      messages[locale]["mobile.fuel.amount"],
      messages[locale]["mobile.fuel.odometer"],
    ],
  );
  assert.deepEqual(
    inputs.map((node) => node.props.value),
    [DRAFT.litres, DRAFT.amount, DRAFT.odometer],
  );
  assert.deepEqual(
    inputs.map((node) => node.props.keyboardType),
    ["decimal-pad", "decimal-pad", "number-pad"],
  );
  assert.ok(inputs.every((node) => node.props.editable === true && minTarget(node) >= 48));
  assert.ok(texts(nodes).includes(DRAFT.motorcycleCode));
  // The currency is part of the amount label ("Amount (MXN)"), not a separate text.
  assert.ok(String(inputs[1]?.props.accessibilityLabel).includes(DRAFT.currency));
}

void test("P22 separates phone save, pending receipt, server receipt and exact later review in both languages", () => {
  for (const locale of ["es-MX", "en"] as const) {
    const render = componentHarness({ locale, scheme: "dark", fontScale: 1.3 }).render;
    const content = (capture: FuelState) =>
      texts(render(`${FEATURE}FuelStatus.tsx`, "FuelStatus", { state: capture }));
    for (const status of ["pending", "sending", "error"] as const) {
      const local = content(state({ event: event(status) }));
      assert.ok(local.includes(messages[locale]["mobile.fuel.saved"]));
      assert.ok(local.includes(messages[locale]["mobile.fuel.receiptPending"]));
      assert.ok(!local.includes(messages[locale]["mobile.fuel.serverReceived"]));
      assert.ok(!local.includes(messages[locale]["mobile.fuel.reviewedAccepted"]));
    }
    const received = content(state({ event: event("sent"), receiptPending: false }));
    assert.ok(received.includes(messages[locale]["mobile.fuel.serverReceived"]));
    assert.ok(received.includes(messages[locale]["mobile.fuel.receiptVerified"]));
    const review = { ...REVIEW_HISTORY, source_event_id: DRAFT.eventId };
    const reviewed = content(state({ event: event("in_review"), review }));
    assert.ok(reviewed.includes(messages[locale]["mobile.fuel.reviewPending"]));
    assert.ok(hasNotice(reviewed, messages[locale]["mobile.fuel.reviewedAccepted"]));
    const unrelated = content(state({ event: event("in_review"), review: REVIEW_HISTORY }));
    assert.ok(!hasNotice(unrelated, messages[locale]["mobile.fuel.reviewedAccepted"]));
    const absentReceipt = content(
      state({ event: event("sent"), receiptPending: false, draft: { ...DRAFT, receipt: null } }),
    );
    assert.ok(!absentReceipt.includes(messages[locale]["mobile.fuel.receiptVerified"]));
  }
});

void test("P22 advisory messages keep Save reachable and submitted invalid values recoverable", () => {
  const render = componentHarness({ locale: "en", scheme: "light", fontScale: 1.3 }).render;
  const keys: Record<FuelState["advisory"]["kind"], MessageKey> = {
    insufficient: "mobile.fuel.insufficient",
    unconfigured: "mobile.fuel.unconfigured",
    decreased: "mobile.fuel.decreased",
    ok: "mobile.fuel.efficiencyOk",
    review: "mobile.fuel.efficiencyReview",
  };
  for (const kind of ["insufficient", "unconfigured", "decreased", "ok", "review"] as const) {
    const advisory = { kind, efficiencyKmL: null, minimum: null, maximum: null };
    const rendered = render(`${FEATURE}FuelAdvisory.tsx`, "FuelAdvisory", { advisory });
    assert.ok(texts(rendered).includes(messages.en[keys[kind]]));
    const footer = render(`${FEATURE}FuelFooter.tsx`, "FuelFooter", {
      model: { state: state({ advisory }), isBusy: false, save: () => undefined },
    });
    assert.equal(footer.find((node) => node.type === "Pressable")?.props.disabled, false);
  }
  const fields = render(`${FEATURE}FuelField.tsx`, "FuelField", {
    field: "litres",
    labelKey: "mobile.fuel.litres",
    value: "NaN",
    disabled: false,
    isSubmitted: true,
    onChange: () => undefined,
  });
  const input = fields.find((node) => node.type === "TextInput");
  assert.ok(input);
  assert.equal(input.props.value, "NaN");
  assert.equal(input.props.editable, true);
  assert.equal(typeof input.props.accessibilityHint, "string");
});

void test("P22 starts the current shift through recovery without flushing an unavailable old draft", () => {
  const render = componentHarness({ locale: "en", scheme: "light", fontScale: 1.3 }).render;
  const calls = { run: 0, recover: 0, begin: 0 };
  const model = {
    state: state({ ready: false, canBegin: true }),
    isBusy: false,
    run: () => {
      calls.run++;
    },
    recover: (operation: () => Promise<void>) => {
      calls.recover++;
      return operation();
    },
    service: {
      begin: () => {
        calls.begin++;
        return Promise.resolve();
      },
    },
  };
  const footer = render(`${FEATURE}FuelFooter.tsx`, "FuelFooter", { model });
  const begin = footer.find((node) => node.type === "Pressable");
  assert.equal(begin?.props.disabled, false);
  press(begin);
  assert.deepEqual(calls, { run: 0, recover: 1, begin: 1 });
});
