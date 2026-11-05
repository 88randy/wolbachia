import assert from "node:assert/strict";
import { it } from "node:test";

import { formatInboxTime } from "../src/sync/format-time.ts";

void it("shows the date outside today so equal clock times cannot hide an older capture", () => {
  const now = new Date(2026, 0, 15, 12);
  const today = new Date(2026, 0, 15, 9, 5).toISOString();
  const yesterday = new Date(2026, 0, 14, 9, 5).toISOString();
  const lastYear = new Date(2025, 0, 15, 9, 5).toISOString();
  assert.equal(formatInboxTime(today, { now, locale: "es-MX" }), "09:05");
  assert.equal(formatInboxTime(yesterday, { now, locale: "es-MX" }), "14/01/2026 ? 09:05");
  assert.equal(formatInboxTime(lastYear, { now, locale: "en" }), "01/15/2025 ? 09:05");
});
