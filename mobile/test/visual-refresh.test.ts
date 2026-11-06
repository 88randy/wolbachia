import assert from "node:assert/strict";
import { test } from "node:test";

import { parseScheme, resolveScheme } from "../src/app/preferences.ts";
import { FONT_FAMILY, MONO_FONT_FAMILY, textStyleFor } from "../src/theme/typography.ts";

void test("appearance follows live system changes until an explicit saved choice", () => {
  const defaultPreference = parseScheme(null);
  assert.equal(resolveScheme(defaultPreference, "light"), "light");
  assert.equal(resolveScheme(defaultPreference, "dark"), "dark");
  assert.equal(resolveScheme(parseScheme("light"), "dark"), "light");
  assert.equal(resolveScheme(parseScheme("dark"), "light"), "dark");
  assert.equal(resolveScheme(parseScheme("unknown"), null), "light");
});

void test("data and status typography use bundled mono while prose keeps the sans family", () => {
  const monoFamilies = new Set<string>(Object.values(MONO_FONT_FAMILY));
  for (const variant of ["number", "code", "status", "overline"] as const) {
    assert.ok(monoFamilies.has(textStyleFor(variant).fontFamily));
  }
  assert.equal(textStyleFor("body").fontFamily, FONT_FAMILY.regular);
  assert.equal(textStyleFor("button", true).fontFamily, MONO_FONT_FAMILY.regular);
});
