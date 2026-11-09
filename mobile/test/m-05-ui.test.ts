import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import type { OutboxEvent } from "../src/outbox/outbox-event.ts";
import type { OutboxStatus } from "../src/outbox/outbox-status.ts";
import type { Schemas } from "@wolbachia/api-client";
import { componentHarness, flattenStyle } from "./support/m-09-render.ts";
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
function acceptedReview(source: string): Schemas["ReviewHistoryEntry"] {
  return {
    id: "00000000-0000-4000-8000-000000000004",
    kind: "review_decision",
    review_item_id: "00000000-0000-4000-8000-000000000005",
    source_event_id: source,
    shift_id: null,
    decision_kind: "accept",
    revision: 2,
    is_terminal: true,
    decision_state: "accepted",
    reason: "Reviewed signed receipt",
    decided_by: "00000000-0000-4000-8000-000000000006",
    decided_at: "2026-11-10T12:00:00Z",
    subjects: [],
    source_status: "in_review",
    source_code: "supply_assignment_changed",
    effect_state: "applied_review",
    incident_id: null,
    declared_void_target_uuid: null,
    approval_current: null,
  };
}

void test("P8 never describes local capture or a pending signature as server receipt or review", () => {
  for (const locale of ["es-MX", "en"] as const) {
    const render = componentHarness({ locale, scheme: "light", fontScale: 1 }).render;
    for (const status of ["pending", "sending", "error"] as const) {
      const content = texts(
        render(`${FEATURE}ReceiptStatus.tsx`, "ReceiptStatus", {
          event: event(status),
          signaturePending: true,
        }),
      );
      assert.ok(content.includes(messages[locale]["mobile.supplyReceipt.saved"]));
      assert.ok(content.includes(messages[locale]["mobile.supplyReceipt.pendingSignature"]));
      assert.ok(!content.includes(messages[locale]["mobile.supplyReceipt.serverReceived"]));
      assert.ok(!content.includes(messages[locale]["mobile.supplyReceipt.review"]));
    }
    const received = texts(
      render(`${FEATURE}ReceiptStatus.tsx`, "ReceiptStatus", {
        event: event("sent"),
        signaturePending: false,
      }),
    );
    assert.ok(received.includes(messages[locale]["mobile.supplyReceipt.serverReceived"]));
    const review = texts(
      render(`${FEATURE}ReceiptStatus.tsx`, "ReceiptStatus", {
        event: event("in_review"),
        signaturePending: false,
      }),
    );
    assert.ok(review.includes(messages[locale]["mobile.supplyReceipt.review"]));
  }
});

function checkFields(locale: Locale, nodes: readonly RenderNode[]): void {
  const input = nodes.find((node) => node.type === "TextInput");
  assert.ok(input);
  assert.equal(input.props.accessibilityLabel, messages[locale]["mobile.supplyReceipt.actual"]);
  assert.equal(input.props.keyboardType, "decimal-pad");
  assert.equal(input.props.editable, true);
  assert.ok(Number(flattenStyle(input.props.style).minHeight) >= 48);
  for (const text of nodes.filter((node) => node.type === "Text")) {
    assert.equal(text.props.numberOfLines, undefined);
    assert.notEqual(text.props.allowFontScaling, false);
    assert.ok(Number(flattenStyle(text.props.style).fontSize) >= 12);
  }
}
void test("P8 declared quantities retain labels and wrapping in both locales/themes at 130 percent host scale", () => {
  for (const locale of ["es-MX", "en"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      const harness = componentHarness({ locale, scheme, fontScale: 1.3 });
      const props = {
        line: {
          id: "actual",
          releaseLineId: "release-line",
          lotId: "00000000-0000-4000-8000-000000000002",
          pieceId: null,
          unitVersionId: "00000000-0000-4000-8000-000000000003",
          expected: "1.250000",
          quantity: "0.500000",
        },
        disabled: false,
        onChange: () => undefined,
      };
      checkFields(locale, harness.render(`${FEATURE}ReceiptLine.tsx`, "ReceiptLine", props));
      const saved = harness.render(`${FEATURE}ReceiptLine.tsx`, "ReceiptLine", {
        ...props,
        disabled: true,
      });
      assert.equal(saved.find((node) => node.type === "TextInput")?.props.editable, false);
    }
  }
});

void test("P8 discrepancy choices keep Other reachable with a named large target and real selection", () => {
  const locale = "es-MX";
  const render = componentHarness({ locale, scheme: "dark", fontScale: 1.3 }).render;
  let selected: string | null = null;
  const controls = render(`${FEATURE}ReceiptDiscrepancyChoices.tsx`, "ReceiptDiscrepancyChoices", {
    selected: "missing",
    disabled: false,
    onChange: (kind: string) => {
      selected = kind;
    },
  }).filter((node) => node.type === "Pressable");
  assert.equal(controls.length, 3);
  for (const control of controls) {
    assert.equal(control.props.accessibilityRole, "button");
    assert.ok(Number(flattenStyle(control.props.style).minHeight) >= 48);
  }
  const other = controls.find(
    (node) => node.props.accessibilityLabel === messages[locale]["mobile.supplyReceipt.other"],
  );
  assert.ok(other);
  assert.equal(typeof other.props.onPress, "function");
  (other.props.onPress as () => void)();
  assert.equal(selected, "other");
});

void test("P8 shows exact later review or incident separately without rewriting the original ingest receipt", () => {
  const locale = "en";
  const render = componentHarness({ locale, scheme: "light", fontScale: 1.3 }).render;
  const original = event("in_review");
  const review = acceptedReview(original.envelope.id);
  const path = `${FEATURE}ReceiptStatus.tsx`;
  const accepted = texts(
    render(path, "ReceiptStatus", { event: original, signaturePending: false, review }),
  );
  assert.ok(accepted.includes(messages[locale]["mobile.supplyReceipt.review"]));
  assert.ok(accepted.includes(messages[locale]["mobile.supplyReceipt.reviewedAccepted"]));
  const unrelated = texts(
    render(path, "ReceiptStatus", {
      event: original,
      signaturePending: false,
      review: { ...review, source_event_id: "another-source" },
    }),
  );
  assert.ok(!unrelated.includes(messages[locale]["mobile.supplyReceipt.reviewedAccepted"]));
  const incidentId = "00000000-0000-4000-8000-000000000007";
  const incident = texts(
    render(path, "ReceiptStatus", {
      event: original,
      signaturePending: false,
      review: {
        ...review,
        decision_kind: "open_incident",
        effect_state: "incident_open",
        incident_id: incidentId,
      },
    }),
  );
  assert.ok(incident.includes(messages[locale]["mobile.supplyReceipt.incidentOpen"]));
  assert.ok(incident.includes(incidentId));
  assert.ok(!incident.includes(messages[locale]["mobile.supplyReceipt.reviewedAccepted"]));
});
