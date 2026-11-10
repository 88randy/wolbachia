import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import { componentHarness, flattenStyle } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

const FEATURE = "mobile/src/features/scanner/";
const UI_CASES = (["es-MX", "en"] as const).flatMap((locale) =>
  (["light", "dark"] as const).map((scheme) => ({ locale, scheme, fontScale: 1.3 })),
);
const noop = () => undefined;
function texts(nodes: readonly RenderNode[]) {
  return nodes.filter(({ type }) => type === "Text").map(({ props }) => props.children);
}
void test("P11 denied camera and P21 invalid results preserve named manual actions across locales/themes at 130 percent", () => {
  for (const config of UI_CASES) {
    const { locale } = config;
    const { render } = componentHarness(config);
    const nodes = render(`${FEATURE}ScannerControls.tsx`, "ScannerControls", {
      model: {
        error: "unavailable",
        cameraError: "denied",
        isCameraVisible: false,
        isBusy: false,
        isRequesting: false,
        code: "OV-1",
        setCode: noop,
        read: () => Promise.resolve(),
        start: () => Promise.resolve(),
        settings: noop,
        retry: noop,
      },
    });
    const input = nodes.find(({ type }) => type === "TextInput");
    assert.ok(input);
    assert.equal(input.props.value, "OV-1");
    assert.equal(input.props.editable, true);
    assert.equal(input.props.accessibilityLabel, messages[locale]["mobile.scanner.code"]);
    const actions = nodes.filter(({ type }) => type === "Pressable");
    assert.ok(
      actions.some(
        ({ props }) =>
          props.accessibilityLabel === messages[locale]["mobile.scanner.lookup"] &&
          props.disabled === false,
      ),
    );
    assert.ok(
      actions.some(
        ({ props }) => props.accessibilityLabel === messages[locale]["mobile.scanner.settings"],
      ),
    );
    for (const action of actions)
      assert.ok(Number(flattenStyle(action.props.style).minHeight) >= 48);
    for (const text of nodes.filter(({ type }) => type === "Text"))
      assert.equal(text.props.numberOfLines, undefined);
  }
});
void test("P12 displays real plan pins and explicit missing metadata without claiming expiry or stock", () => {
  for (const config of UI_CASES) {
    const { locale } = config;
    const { render } = componentHarness(config);
    const content = texts(
      render(`${FEATURE}SupplyDetails.tsx`, "SupplyDetails", {
        resource: {
          kind: "lot",
          id: "lot-uuid",
          code: null,
          supply: {
            assignmentId: "assignment-uuid",
            revision: 7,
            date: "2026-11-09",
            lineId: "line-uuid",
            unitId: "unit-version-uuid",
            expected: "2.500000",
          },
        },
      }),
    );
    for (const value of [
      "lot-uuid",
      "unit-version-uuid",
      "2.500000",
      "assignment-uuid",
      "7",
      messages[locale]["mobile.scanner.missingMetadata"],
    ])
      assert.ok(content.includes(value));
    assert.ok(!content.includes(messages[locale]["mobile.ovitrap.serverReceived"]));
  }
});
