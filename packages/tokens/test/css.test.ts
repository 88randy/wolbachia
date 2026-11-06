import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DARK_SELECTOR,
  flattenToCssVariables,
  renderTokensCss,
  toCssValue,
  toKebabCase,
} from "../src/css.ts";
import { parseCustomProperties } from "./helpers/css-parser.ts";

void describe("css naming and values", () => {
  void test("toKebabCase handles camelCase and decimal keys", () => {
    assert.equal(toKebabCase("actionStrong"), "action-strong");
    assert.equal(toKebabCase("0.5"), "0-5");
  });

  void test("toCssValue appends px to numbers and keeps strings", () => {
    assert.equal(toCssValue(12), "12px");
    assert.equal(toCssValue("#3772FF"), "#3772FF");
  });

  void test("flattenToCssVariables walks nested groups", () => {
    const variables = flattenToCssVariables(
      { status: { success: { fg: "#0B6B35" } }, size: 8 },
      "--x",
    );

    assert.deepEqual(variables, { "--x-status-success-fg": "#0B6B35", "--x-size": "8px" });
  });

  void test("flattenToCssVariables rejects unsupported leaves", () => {
    assert.throws(() => flattenToCssVariables({ broken: null }, "--x"), TypeError);
  });
});

const THEMED_PREFIXES = [
  "color-",
  "web-sidebar",
  "web-banner",
  "web-map",
  "web-chart-",
  "web-band",
  "web-delta",
  "web-scrollbar",
  "web-overlay",
  "web-button-",
];

function isThemed(name: string): boolean {
  return (
    !name.startsWith("web-chart-geometry-") &&
    THEMED_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

void describe("renderTokensCss", () => {
  const css = renderTokensCss();

  void test("light values live in :root", () => {
    const light = parseCustomProperties(css, ":root");

    assert.equal(light["color-brand"], "#3772FF");
    assert.equal(light["color-text-primary"], "#20252D");
    assert.equal(light["radius-md"], "12px");
    assert.equal(light["web-chart-2"], "#B85C25");
  });

  void test("shell sizes are shared lengths in px", () => {
    const light = parseCustomProperties(css, ":root");
    const dark = parseCustomProperties(css, DARK_SELECTOR);

    assert.equal(light["web-layout-sidebar-width"], "248px");
    assert.equal(light["web-layout-sidebar-collapsed-width"], "64px");
    assert.equal(light["web-layout-top-bar-height"], "56px");
    assert.equal(light["web-layout-compact-breakpoint"], "768px");
    assert.equal(dark["web-layout-sidebar-width"], undefined);
    assert.equal(light["web-type-title-font-size"], "24px");
    assert.equal(light["web-icon-md"], "20px");
  });

  void test("dark overrides live under the data-theme selector", () => {
    const dark = parseCustomProperties(css, DARK_SELECTOR);

    assert.equal(dark["color-action"], "#7FA4FF");
    assert.equal(dark["web-map-water"], "#16335E");
  });

  void test("every themed variable is overridden in dark and nothing else is", () => {
    const light = parseCustomProperties(css, ":root");
    const dark = parseCustomProperties(css, DARK_SELECTOR);

    const themedInLight = Object.keys(light).filter(isThemed);

    assert.deepEqual(Object.keys(dark).sort(), themedInLight.sort());
  });

  void test("refresh roles produce usable CSS rather than px duration values", () => {
    const light = parseCustomProperties(css, ":root");
    const dark = parseCustomProperties(css, DARK_SELECTOR);
    assert.match(light["font-family-mono"] ?? "", /JetBrains Mono/);
    assert.equal(light["radius-card"], "20px");
    assert.equal(light["radius-inner"], "14px");
    assert.equal(light["web-motion-fast"], "150ms");
    assert.equal(light["web-motion-normal"], "200ms");
    assert.equal(light["web-layout-sidebar-min-width"], "200px");
    assert.equal(light["web-layout-sidebar-max-width"], "360px");
    assert.equal(light["web-layout-sidebar-resize-step"], "16px");
    assert.equal(light["web-layout-scrollbar-size"], "6px");
    for (const name of [
      "color-surface-muted",
      "color-surface-raised",
      "web-scrollbar-thumb-hover",
      "web-sidebar-active-background",
      "web-delta-positive",
      "web-chart-grid",
      "web-overlay-backdrop",
      "web-button-primary-hover",
      "web-button-primary-pressed",
      "web-button-secondary-hover",
      "web-button-secondary-pressed",
      "web-button-tertiary-hover",
      "web-button-tertiary-pressed",
      "web-button-ghost-hover",
      "web-button-ghost-pressed",
      "web-button-destructive-tint-hover",
      "web-button-destructive-tint-pressed",
      "web-button-danger-solid-hover",
      "web-button-danger-solid-pressed",
    ]) {
      assert.ok(light[name], `${name} missing in light`);
      assert.ok(dark[name], `${name} missing in dark`);
    }
    assert.match(light["shadow-card"] ?? "", /32px/);
    assert.match(light["shadow-overlay"] ?? "", /48px/);
  });
});
