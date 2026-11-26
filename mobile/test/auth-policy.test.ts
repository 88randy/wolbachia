import assert from "node:assert/strict";
import { it } from "node:test";

import { readAuthRules, hasClockSkew } from "../src/auth/auth-rules.ts";
import { loginError } from "../src/auth/login-error.ts";
import { canLoginAs } from "../src/auth/login-policy.ts";
import type { Schemas } from "@wolbachia/api-client";
import { createStores, makeEnvelope } from "./support/factories.ts";

function snapshot(values: Record<string, number | null>): Schemas["RulesSnapshot"] {
  return {
    version: "test",
    next_change_at: null,
    parameters: Object.entries(values).map(([key, value]) => ({
      key,
      value,
      value_type: "integer",
      unit: "count",
      effective_from: null,
      version_id: null,
    })),
  };
}

void it("defaults missing/null rules and clamps every server-supplied authentication threshold", () => {
  assert.deepEqual(readAuthRules(null), {
    pinMaxAttempts: 3,
    sessionIdleMinutes: 5,
    clockSkewReviewSeconds: 300,
    backgroundLockGraceSeconds: 120,
  });
  assert.deepEqual(readAuthRules(snapshot({ pin_max_attempts: null })), readAuthRules(null));
  assert.deepEqual(
    readAuthRules(
      snapshot({
        pin_max_attempts: 40,
        session_idle_minutes: 0,
        clock_skew_review_seconds: 8000,
        background_lock_grace_seconds: 5000,
      }),
    ),
    {
      pinMaxAttempts: 10,
      sessionIdleMinutes: 1,
      clockSkewReviewSeconds: 3600,
      backgroundLockGraceSeconds: 900,
    },
  );
  assert.deepEqual(
    readAuthRules(
      snapshot({
        pin_max_attempts: -1,
        session_idle_minutes: 50,
        clock_skew_review_seconds: 1,
        background_lock_grace_seconds: 1,
      }),
    ),
    {
      pinMaxAttempts: 1,
      sessionIdleMinutes: 30,
      clockSkewReviewSeconds: 30,
      backgroundLockGraceSeconds: 10,
    },
  );
  assert.equal(readAuthRules(snapshot({ pin_max_attempts: NaN })).pinMaxAttempts, 3);
});

void it("warns about positive and negative clock skew only strictly beyond the rule threshold", () => {
  const phone = Date.parse("2026-01-01T12:00:00Z");
  for (const seconds of [-301, -300, 300, 301]) {
    assert.equal(
      hasClockSkew(new Date(phone + seconds * 1000).toISOString(), phone, 300),
      Math.abs(seconds) > 300,
    );
  }
});

void it("maps first-login failures to localized P1 states and respects Retry-After", () => {
  assert.equal(loginError(undefined).key, "mobile.login.noSignal");
  for (const [code, status, key] of [
    ["invalid_credentials", 401, "mobile.login.wrongCredentials"],
    ["device_revoked", 403, "mobile.login.deviceRevoked"],
    ["no_active_membership", 403, "mobile.login.genericError"],
    ["device_organization_mismatch", 403, "mobile.login.genericError"],
  ] as const) {
    assert.equal(loginError({ code, detail: "" }, new Response(null, { status })).key, key);
  }
  assert.deepEqual(
    loginError(
      { code: "throttled", detail: "" },
      new Response(null, { status: 429, headers: { "Retry-After": "61" } }),
    ),
    { key: "mobile.login.throttled", minutes: 2 },
  );
  assert.equal(
    loginError({}, new Response(null, { status: 429 })).key,
    "mobile.login.throttledUnknown",
  );
});

void it("allows same-user relogin but blocks a different user while any local record exists", () => {
  assert.equal(canLoginAs("next", "previous", false), true);
  assert.equal(canLoginAs("next", "previous", true), false);
  assert.equal(canLoginAs("previous", "previous", true), true);
});

void it("owner data includes outbox history in every status", async () => {
  const stores = await createStores();
  assert.equal(await stores.hasLocalRecords(), false);
  const event = makeEnvelope();
  await stores.outbox.enqueue(event);
  for (const status of ["pending", "sending", "error", "sent", "rejected", "in_review"]) {
    await stores.db.runAtomically([
      {
        sql: "UPDATE outbox_event SET local_status = ? WHERE id = ?",
        params: [status, event.id],
      },
    ]);
    assert.equal(await stores.hasLocalRecords(), true, status);
  }
});
