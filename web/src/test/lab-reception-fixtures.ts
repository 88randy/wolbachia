import type { Schemas } from "@wolbachia/api-client";
import { createFakeApi, makeMe } from "./fake-api";
export const BAG_ID = "30000000-0000-4000-8000-000000000001";
export const READING_ID = "30000000-0000-4000-8000-000000000002";
export const RECEIPT_ID = "30000000-0000-4000-8000-000000000003";
export const WHEN = "2026-11-03T15:10:00Z";
const SOURCE = {
  evaluated_rules: {},
  rule_version_ids: {},
  event_id: BAG_ID,
  device_time: WHEN,
  server_received_at: WHEN,
  rules_version: "r1",
  catalog_version: "c1",
  manual_capture: false,
  gps: null,
  status: "active" as const,
  voided_at: null,
  void_reason: "",
  void_reason_code: "",
  created_by: BAG_ID,
  created_at: WHEN,
};
export function receipt(overrides: Partial<Schemas["LabReceipt"]> = {}): Schemas["LabReceipt"] {
  return {
    id: RECEIPT_ID,
    bag_id: BAG_ID,
    reading_id: READING_ID,
    kind: "bag",
    created_at: WHEN,
    created_by: BAG_ID,
    ...overrides,
  };
}
export function bag(): Schemas["Bag"] {
  return {
    id: BAG_ID,
    code: "B-030",
    reading: READING_ID,
    collector: BAG_ID,
    field_flags: {},
    lab: { status: "expected", revision: 0, receipt_id: null, count_id: null, rejection_id: null },
    evaluated_rules: {},
    rule_version_ids: {},
    event_id: BAG_ID,
    device_time: WHEN,
    server_received_at: WHEN,
    rules_version: "r1",
    catalog_version: "c1",
    manual_capture: false,
    gps: null,
    status: "active",
    voided_at: null,
    void_reason: "",
    void_reason_code: "",
    created_by: BAG_ID,
    created_at: WHEN,
  };
}
export function reading(): Schemas["Reading"] {
  return {
    ...SOURCE,
    id: READING_ID,
    code: READING_ID,
    ovitrap: BAG_ID,
    point_version: BAG_ID,
    finding: BAG_ID,
    finding_code: "normal",
    incident_link: null,
    finding_label: {},
    other_text: "",
    paddle_present: true,
    has_eggs: false,
    temperature_c: null,
    humidity_pct: null,
    paddle_type: null,
    is_lagged: false,
    is_index_excluded: false,
    index_exclusion_reason: "",
    is_countable: true,
    lab_receipt: null,
    epi_week: "2026-W45",
    bag_id: BAG_ID,
    bag_code: "B-030",
  };
}
export function page(results: readonly unknown[], count = results.length) {
  return Response.json({ count, results, next: null, previous: null });
}
export function receptionApi(permissions = ["bag.receive", "reading.read", "egg_count.create"]) {
  return createFakeApi({
    "GET /api/v1/me/": () =>
      Response.json(
        makeMe({
          permissions,
          scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
        }),
      ),
    "GET /api/v1/lab-receptions/": () => page([]),
    "GET /api/v1/bags/": () => page([]),
    "GET /api/v1/lab-reception-discrepancies/": () => page([]),
    [`GET /api/v1/bags/${BAG_ID}/`]: () => Response.json(bag()),
    [`GET /api/v1/readings/${READING_ID}/`]: () => Response.json(reading()),
  });
}
export function receptionReply(code = "B-030") {
  return Response.json({
    bag: { id: BAG_ID, code },
    reading: { id: READING_ID, paddle_present: true },
    receipt: receipt(),
  });
}
