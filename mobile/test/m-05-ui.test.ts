import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import type { OutboxEvent } from "../src/outbox/outbox-event.ts";
import type { OutboxStatus } from "../src/outbox/outbox-status.ts";
import { componentHarness, flattenStyle, minHeightOf } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

const FEATURE = "mobile/src/features/supply-receipt/";
function event(status: OutboxStatus): OutboxEvent {
  return {
    seq: 1,
    status,
    attempts: 0,
    lastError: null,
    result: null,
    envelope: {
      id: "00000000-0000-4000-8000-000000000001",
      type: "supplies.receive",
      schema_version: 1,
      device_time: "2026-11-09T12:00:00Z",
      payload: {},
      shift_id: null,
      gps: null,
      rules_version: "rules",
      catalog_version: "catalog",
      manual_capture: false,
      voids_event_id: null,
    },
  };
}
function texts(nodes: readonly RenderNode[]): readonly unknown[] {
  return nodes.filter((node) => node.type === "Text").map((node) => node.props.children);
}
// The scan button needs the services container and the camera; the count logic does not.
const SCAN_STUB = { "ReceiptScanButton.tsx": { ReceiptScanButton: () => null } };
const DRAFT_LINE = {
  id: "actual",
  releaseLineId: "release-line",
  lotId: "00000000-0000-4000-8000-000000000002",
  pieceId: null,
  unitVersionId: "00000000-0000-4000-8000-000000000003",
  expected: "5",
  quantity: "2",
};
function model(patch: Record<string, unknown> = {}) {
  const edits: string[] = [];
  return {
    edits,
    value: {
      state: { ready: true, event: null, feedback: null },
      isBusy: false,
      errorKey: null,
      service: { quantity: () => Promise.resolve(), discrepancy: () => Promise.resolve() },
      edit: (field: string) => {
        edits.push(field);
      },
      ...patch,
    },
  };
}
function press(node: RenderNode | undefined): void {
  assert.ok(node);
  assert.equal(typeof node.props.onPress, "function");
  (node.props.onPress as () => void)();
}
function pressable(nodes: readonly RenderNode[], label: string): RenderNode | undefined {
  return nodes.find((node) => node.props.accessibilityLabel === label);
}

void test("P8 never describes local capture as server receipt or review", () => {
  const keys = {
    pending: "field.receipt.savedBody",
    sending: "field.receipt.savedBody",
    error: "field.receipt.savedBody",
    sent: "field.receipt.sentBody",
    in_review: "field.receipt.reviewBody",
    rejected: "field.receipt.rejectedBody",
  } as const;
  const bodies = Object.values(keys);
  for (const locale of ["es-MX", "en"] as const) {
    const render = componentHarness({ locale, scheme: "light", fontScale: 1 }).render;
    for (const [status, key] of Object.entries(keys) as [OutboxStatus, keyof typeof messages.en][]) {
      const content = texts(render(`${FEATURE}ReceiptSaved.tsx`, "ReceiptSaved", { event: event(status) }));
      assert.ok(content.includes(messages[locale]["field.receipt.savedTitle"]));
      assert.ok(content.includes(messages[locale][key]), `${status} shows its own body`);
      for (const other of bodies.filter((candidate) => candidate !== key))
        assert.ok(!content.includes(messages[locale][other]), `${status} hides ${other}`);
    }
  }
});

function checkText(nodes: readonly RenderNode[]): void {
  for (const text of nodes.filter((node) => node.type === "Text")) {
    assert.equal(text.props.numberOfLines, undefined);
    assert.notEqual(text.props.allowFontScaling, false);
    assert.ok(Number(flattenStyle(text.props.style).fontSize) >= 12);
  }
}
void test("P8 count step keeps whole units on big plus/minus and fractions on a decimal field, in both locales/themes at 130 percent", () => {
  for (const locale of ["es-MX", "en"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const render = componentHarness({ locale, scheme, fontScale: 1.3, stubs: SCAN_STUB }).render;
      const { value, edits } = model();
      const whole = render(`${FEATURE}ReceiptCountStep.tsx`, "ReceiptCountStep", {
        model: value,
        draft: { lines: [DRAFT_LINE], discrepancy: null, evidence: [] },
        onNext: () => undefined,
      });
      checkText(whole);
      const label = messages[locale]["field.receipt.supply"]
        .replace("{number}", "1")
        .replace("{expected}", "5");
      assert.ok(texts(whole).includes(label));
      const plus = pressable(
        whole,
        messages[locale]["courier.counter.increase"].replace("{label}", label),
      );
      assert.ok(plus && minHeightOf(plus) >= 48);
      press(plus);
      assert.deepEqual(edits, ["quantity.actual"]);

      const fraction = render(`${FEATURE}ReceiptCountStep.tsx`, "ReceiptCountStep", {
        model: value,
        draft: { lines: [{ ...DRAFT_LINE, expected: "1.25", quantity: "0.5" }] },
        onNext: () => undefined,
      });
      const input = fraction.find((node) => node.type === "TextInput");
      assert.ok(input);
      assert.equal(input.props.keyboardType, "decimal-pad");
      assert.equal(input.props.value, "0.5");
      assert.equal(input.props.editable, true);
      assert.ok(minHeightOf(input) >= 48);
      const locked = render(`${FEATURE}ReceiptCountStep.tsx`, "ReceiptCountStep", {
        model: model({ isBusy: true }).value,
        draft: { lines: [{ ...DRAFT_LINE, expected: "1.25", quantity: "0.5" }] },
        onNext: () => undefined,
      });
      assert.equal(locked.find((node) => node.type === "TextInput")?.props.editable, false);
    }
  }
});

void test("P8 discrepancy choices keep Other reachable with a named large target and real selection", () => {
  const locale = "es-MX";
  const render = componentHarness({ locale, scheme: "dark", fontScale: 1.3 }).render;
  const { value, edits } = model();
  const draft = { lines: [DRAFT_LINE], discrepancy: { kind: "missing", text: "" }, evidence: [] };
  const nodes = render(`${FEATURE}ReceiptProblemStep.tsx`, "ReceiptProblemStep", {
    model: value,
    draft,
    onNext: () => undefined,
    onBack: () => undefined,
  });
  const kinds = nodes.filter((node) => node.props.accessibilityRole === "radio");
  // Yes / No answer first, then the three kinds in a fixed order with Other last.
  assert.deepEqual(
    kinds.map((node) => node.props.accessibilityLabel).slice(2),
    (["missing", "damaged", "other"] as const).map(
      (kind) => messages[locale][`field.receipt.kind.${kind}`],
    ),
  );
  for (const control of kinds) assert.ok(minHeightOf(control) >= 48);
  const other = pressable(nodes, messages[locale]["field.receipt.kind.other"]);
  assert.equal((other?.props.accessibilityState as { checked: boolean }).checked, false);
  press(other);
  assert.deepEqual(edits, ["discrepancy"]);
  const missing = pressable(nodes, messages[locale]["field.receipt.kind.missing"]);
  assert.equal((missing?.props.accessibilityState as { checked: boolean }).checked, true);
});
