import { EMPTY_ANSWERS } from "../../src/features/ovitrap-check/new-draft.ts";
import type { Draft, Catalog, Assignment, Rules } from "../../src/features/ovitrap-check/types.ts";
export const POINT = {
  id: "22222222-2222-4222-8222-222222222222",
  code: "OV-1",
  lat: 19,
  lng: -99,
};
const item = (code: string) => ({
  code,
  label_es: code,
  label_en: code,
  is_other: code === "other",
  requires_photo: false,
});
export const CATALOG: Catalog = {
  version: "catalog-v1",
  findings: ["fine", "closed-house", "absent", "missing", "destroyed", "no-paddle", "other"].map(
    item,
  ),
  paddleTypes: ["standard", "other"].map(item),
  voidReasons: [item("other")],
};
export const RULES: Rules = {
  version: "rules-v1",
  nextChangeAt: null,
  maxAccuracyM: 50,
  maxDistanceM: 50,
  maxPaddleReuses: 2,
  gpsPolicy: "review",
  stalePolicy: "review",
};
export const ASSIGNMENT: Assignment = {
  version: "assignment-v1",
  epiWeek: "2026-W45",
  organization: { timezone: "America/Mexico_City", epi_week: "iso" },
  points: [POINT],
  ovitraps: [],
  bags: [{ id: "33333333-3333-4333-8333-333333333333", code: "B-QR" }],
  reuse: [],
};
export function makeDraft(patch: Partial<Draft> = {}): Draft {
  return {
    eventId: "11111111-1111-4111-8111-111111111111",
    deviceTime: "2026-11-05T15:00:00.000Z",
    mode: "check",
    ovitrapId: "44444444-4444-4444-8444-444444444444",
    point: POINT,
    shiftId: "55555555-5555-4555-8555-555555555555",
    catalog: CATALOG,
    rules: RULES,
    assignment: ASSIGNMENT,
    gps: { lat: 19, lng: -99, accuracy_m: 5 },
    manualCapture: false,
    step: "finding",
    ...EMPTY_ANSWERS,
    finding: "fine",
    ...patch,
  };
}
