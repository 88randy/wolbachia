import assert from "node:assert/strict";
import { it } from "node:test";

import { formatClock, formatInboxTime } from "../src/sync/format-time.ts";

const MERIDA = "America/Merida";

void it("shows the date outside today so equal clock times cannot hide an older capture", () => {
  const now = new Date("2026-01-15T18:00:00Z");
  const today = "2026-01-15T15:05:00Z";
  const yesterday = "2026-01-14T15:05:00Z";
  const lastYear = "2025-01-15T15:05:00Z";
  assert.equal(formatInboxTime(today, { timeZone: MERIDA, now, locale: "es-MX" }), "09:05");
  assert.equal(
    formatInboxTime(yesterday, { timeZone: MERIDA, now, locale: "es-MX" }),
    "14/01/2026 ? 09:05",
  );
  assert.equal(
    formatInboxTime(lastYear, { timeZone: MERIDA, now, locale: "en" }),
    "01/15/2025 ? 09:05",
  );
});

void it("uses the organization's day and clock after 18:00 in Mérida, when UTC is already tomorrow", () => {
  const evening = "2026-11-11T02:30:00Z";
  const now = new Date("2026-11-11T03:00:00Z");
  assert.equal(formatClock(evening, MERIDA), "20:30");
  assert.equal(formatInboxTime(evening, { timeZone: MERIDA, now }), "20:30");
  assert.equal(
    formatInboxTime("2026-11-10T13:00:00Z", { timeZone: MERIDA, now: new Date(evening) }),
    "07:00",
  );
});
