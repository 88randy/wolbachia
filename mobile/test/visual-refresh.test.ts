import assert from "node:assert/strict";
import { test } from "node:test";

import { componentHarness } from "./support/m-09-render.ts";
import type { ShiftSnapshot } from "../src/features/shift-open/service.ts";
import type { OutboxEvent } from "../src/outbox/outbox-event.ts";
import { unlockTitle } from "../src/screens/auth/unlock-presentation.ts";
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

void test("Home severe review shows one receipt and one actionable blocker without stale copy", () => {
  const opening: OutboxEvent = {
    seq: 1,
    status: "in_review",
    attempts: 1,
    lastError: null,
    result: { code: "severe_check", params: {} },
    envelope: {
      id: "opening",
      type: "shift.open",
      schema_version: 1,
      device_time: "2026-11-09T12:00:00Z",
      shift_id: "shift",
      payload: {},
      gps: null,
      rules_version: "rules",
      catalog_version: "catalog",
      manual_capture: false,
    },
  };
  const state: ShiftSnapshot = {
    draft: null,
    opening,
    catalog: null,
    map: null,
    gate: "severe",
    canDepart: false,
    hasOdometerWarning: false,
    lastOdometer: null,
  };
  for (const locale of ["es-MX", "en"] as const) {
    const renderer = componentHarness({ locale, scheme: "light", fontScale: 1.3 });
    const nodes = renderer.render("mobile/src/features/shift-open/ShiftStatus.tsx", "ShiftStatus", {
      state,
    });
    const notices = nodes.filter((node) => node.props.accessibilityLiveRegion === "polite");
    assert.equal(notices.length, 2);
    const text = nodes
      .filter((node) => node.type === "Text")
      .map((node) => node.props.children)
      .filter(Boolean);
    assert.equal(text.length, 2);
    assert.match(
      String(text[0]),
      locale === "es-MX" ? /Recibido.*En revisi\u00f3n/ : /Received.*In review/,
    );
    assert.match(
      String(text[1]),
      locale === "es-MX" ? /falla grave.*supervisor/ : /severe fault.*supervisor/,
    );
    assert.doesNotMatch(
      text.join(" "),
      /no confirma|not confirm|Revisi\u00f3n posterior|Subsequent review|Guarda la|Save the/,
    );
  }
});

void test("PIN greeting uses the profile name or a neutral greeting for missing names", () => {
  const base = { phase: "locked" as const, isPasswordRequired: false, profile: null };
  assert.equal(unlockTitle(base), "mobile.unlock.greetingNeutral");
  const named = { ...base, profile: { firstName: "  Test  " } };
  assert.equal(unlockTitle(named), "mobile.unlock.greeting");
  assert.equal(
    unlockTitle({ ...named, profile: { firstName: "   " } }),
    "mobile.unlock.greetingNeutral",
  );
  assert.equal(unlockTitle({ ...base, phase: "createPin" }), "mobile.unlock.createTitle");
  assert.equal(unlockTitle({ ...named, isPasswordRequired: true }), "mobile.unlock.passwordTitle");
});
