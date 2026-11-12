import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import { componentHarness, minHeightOf } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

const FEATURE = "mobile/src/features/scanner/";
const UI_CASES = (["es-MX", "en"] as const).flatMap((locale) =>
  (["light", "dark"] as const).map((scheme) => ({ locale, scheme, fontScale: 1.3 })),
);
const noop = () => undefined;
function texts(nodes: readonly RenderNode[]) {
  return nodes.filter(({ type }) => type === "Text").map(({ props }) => props.children);
}
const MANUAL = { react: { useState: () => [true, noop] } };
function scannerModel(read: (code: string, isManual: boolean) => Promise<void>) {
  return {
    error: "unavailable",
    cameraError: "denied",
    isCameraVisible: false,
    isBusy: false,
    isRequesting: false,
    code: "OV-1",
    setCode: noop,
    read,
    start: () => Promise.resolve(),
    settings: noop,
    retry: noop,
  };
}
void test("P11 denied camera and P21 invalid results keep a named manual way in across locales/themes at 130 percent", () => {
  for (const config of UI_CASES) {
    const { locale } = config;
    const reads: [string, boolean][] = [];
    const model = scannerModel((code, isManual) => {
      reads.push([code, isManual]);
      return Promise.resolve();
    });
    // Closed by default: the invalid result is explained and "damaged label" is the only way in.
    const closed = componentHarness(config).render(`${FEATURE}ScannerControls.tsx`, "ScannerControls", {
      model,
    });
    assert.ok(texts(closed).includes(messages[locale]["field.scan.unavailable"]));
    assert.equal(closed.find(({ type }) => type === "TextInput"), undefined);
    const damaged = closed.find(
      ({ props }) => props.accessibilityLabel === messages[locale]["field.scan.damaged"],
    );
    assert.ok(damaged && minHeightOf(damaged) >= 48);
    // Open: the typed code is retained, editable, and Use this code reads it as manual input.
    const nodes = componentHarness({ ...config, stubs: MANUAL }).render(
      `${FEATURE}ScannerControls.tsx`,
      "ScannerControls",
      { model },
    );
    const input = nodes.find(({ type }) => type === "TextInput");
    assert.ok(input);
    assert.equal(input.props.value, "OV-1");
    assert.equal(input.props.editable, true);
    assert.equal(input.props.accessibilityLabel, messages[locale]["field.scan.codeLabel"]);
    const lookup = nodes.find(
      ({ props }) => props.accessibilityLabel === messages[locale]["field.scan.useCode"],
    );
    assert.ok(lookup && lookup.props.disabled === false && minHeightOf(lookup) >= 48);
    (lookup.props.onPress as () => void)();
    assert.deepEqual(reads, [["OV-1", true]]);
    for (const text of nodes.filter(({ type }) => type === "Text"))
      assert.equal(text.props.numberOfLines, undefined);
  }
});
void test("P12 shows what the supply is and for which day, never internal ids, and explains an unknown code", () => {
  for (const config of UI_CASES) {
    const { locale } = config;
    const { render } = componentHarness(config);
    const resource = {
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
    };
    const content = texts(render(`${FEATURE}SupplyDetails.tsx`, "SupplyDetails", { resource }));
    for (const value of [
      messages[locale]["field.scan.supplyTitle"],
      messages[locale]["field.scan.supplyQuantity"].replace("{quantity}", "2.500000"),
      messages[locale]["field.scan.supplyDate"].replace("{date}", "2026-11-09"),
    ])
      assert.ok(content.includes(value), value);
    for (const internal of ["lot-uuid", "unit-version-uuid", "assignment-uuid", "line-uuid", "7"])
      assert.ok(!content.includes(internal), internal);
    assert.ok(!content.includes(messages[locale]["mobile.ovitrap.serverReceived"]));
    const unknown = texts(
      render(`${FEATURE}SupplyDetails.tsx`, "SupplyDetails", {
        resource: { ...resource, supply: null },
      }),
    );
    assert.ok(unknown.includes(messages[locale]["field.scan.unavailable"]));
  }
});
