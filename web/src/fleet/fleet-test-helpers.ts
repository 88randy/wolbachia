import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Schemas } from "@wolbachia/api-client";
import { createFakeApi, makeMe, makeVoidReasonItems } from "../test/fake-api";
import type { FakeApiRoutes, RecordedRequest } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import { IDENTITY_HEADER } from "../session/attestation";
import { FAKE_IDENTITY } from "../test/fake-api";
import { traceFleetReads, acceptFleetRead } from "../test/fleet-read-test-helpers";
import type { FleetRead, FleetReadTarget } from "../test/fleet-read-test-helpers";

export const LIST = "/fleet/motorcycles";
export const GET = "GET /api/v1/motorcycles/";
export const ALLOWED = makeMe({
  permissions: ["motorcycle.read", "motorcycle.manage", "motorcycle.unblock"],
  scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "none", ids: [] } },
});
export function motorcycle(overrides: Partial<Schemas["Motorcycle"]> = {}): Schemas["Motorcycle"] {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    code: "M-03",
    plate: "TEST-03",
    center: null,
    revision: 0,
    is_blocked: true,
    blocked_reason: "severe_check",
    created_at: "2026-10-01T15:00:00Z",
    created_by: null,
    voided_at: null,
    voided_by: null,
    void_reason_code: "",
    void_reason: "",
    ...overrides,
  };
}
export function pageOf(results = [motorcycle()], count = results.length) {
  return Response.json({ count, next: null, previous: null, results });
}
export function motorcycleDetail(
  overrides: Partial<Schemas["MotorcycleDetail"]> = {},
): Schemas["MotorcycleDetail"] {
  return {
    ...motorcycle(),
    metrics: {
      last_service: null,
      next_service_due_km: null,
      next_service_due_date: null,
      latest_odometer: null,
      latest_efficiency: null,
      efficiency_status: "unavailable",
      due_metric_provenance: {},
    },
    ...overrides,
  };
}
const HISTORY_AUDIT = {
  motorcycle: motorcycle().id,
  created_at: "2026-10-02T15:00:00Z",
  created_by: null,
  voided_at: null,
  voided_by: null,
  void_reason: "",
  void_reason_code: "",
};
export function serviceRecord(
  overrides: Partial<Schemas["ServiceRecord"]> = {},
): Schemas["ServiceRecord"] {
  return {
    ...HISTORY_AUDIT,
    id: "00000000-0000-4000-8000-000000000010",
    kind: "inspection",
    performed_at: "2026-10-02",
    odometer_km: 12500,
    notes: "Synthetic inspection",
    service_interval_km: null,
    service_interval_days: null,
    due_metric_provenance: {},
    ...overrides,
  };
}
export function responsibilityLetter(
  overrides: Partial<Schemas["ResponsibilityLetter"]> = {},
): Schemas["ResponsibilityLetter"] {
  return {
    ...HISTORY_AUDIT,
    id: "00000000-0000-4000-8000-000000000017",
    courier: "00000000-0000-4000-8000-000000000014",
    issued_at: "2026-10-02T14:30:00Z",
    document_reference: "00000000-0000-4000-8000-000000000018",
    notes: "Synthetic responsibility letter",
    ...overrides,
  };
}
export function fuelLoad(overrides: Partial<Schemas["FuelLoad"]> = {}): Schemas["FuelLoad"] {
  return {
    id: "00000000-0000-4000-8000-000000000011",
    event: "00000000-0000-4000-8000-000000000012",
    shift: "00000000-0000-4000-8000-000000000013",
    motorcycle: motorcycle().id,
    courier: "00000000-0000-4000-8000-000000000014",
    litres: "2.000",
    amount: "100.00",
    currency: "MXN",
    odometer_km: 12510,
    receipt_upload_id: null,
    receipt_pending: true,
    is_full_refill: false,
    efficiency_km_l: null,
    efficiency_status: "unavailable",
    threshold_min: null,
    threshold_max: null,
    rule_provenance: {},
    baseline: null,
    provisional: false,
    created_at: HISTORY_AUDIT.created_at,
    created_by: null,
    device_time: "2026-10-02T14:55:00Z",
    server_received_at: HISTORY_AUDIT.created_at,
    rules_version: "synthetic-rules",
    catalog_version: "synthetic-catalog",
    ...overrides,
  };
}
export function fleetFault(overrides: Partial<Schemas["Incident"]> = {}): Schemas["Incident"] {
  return {
    id: "00000000-0000-4000-8000-000000000015",
    motorcycle: motorcycle().id,
    field_event: "00000000-0000-4000-8000-000000000016",
    blocked_reason: "severe_check",
    created_at: HISTORY_AUDIT.created_at,
    created_by: null,
    is_cleared: false,
    cleared_at: null,
    clearance: null,
    ...overrides,
  };
}
export function historyPage(results: unknown[], count = results.length) {
  return Response.json({ count, next: null, previous: null, results });
}
export function evidenceFile() {
  const bytes = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=",
    ),
    (value) => value.charCodeAt(0),
  );
  const file = new File([bytes], "inspection.png", { type: "image/png" });
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(bytes.buffer.slice(0)),
  });
  return { file, bytes };
}
/** B04's one raw-byte route is outside the old JSON-only fake recorder. No real network is used. */
function evidenceFetch(api: ReturnType<typeof createFakeApi>, routes: FakeApiRoutes) {
  return async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (request.method !== "PUT" || !/^\/api\/v1\/field\/uploads\/[^/]+\/content\/$/.test(path))
      return api.fetch(request);
    const recorded: RecordedRequest = {
      method: "PUT",
      path,
      headers: request.headers,
      signal: request.signal,
      body: new Uint8Array(await request.clone().arrayBuffer()),
    };
    api.requests.push(recorded);
    const reply = routes[`PUT ${path}`];
    if (!reply) throw new Error(`No synthetic raw route for ${path}`);
    const answer = typeof reply === "function" ? await reply(recorded) : reply.clone();
    answer.headers.set(IDENTITY_HEADER, FAKE_IDENTITY);
    return answer;
  };
}
export function fleetEvidenceApi(routes: FakeApiRoutes) {
  const api = createFakeApi(routes);
  return { ...api, fetch: evidenceFetch(api, routes) };
}
function firstRecord(payload: unknown) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("results" in payload) ||
    !Array.isArray(payload.results)
  )
    return;
  const rows: unknown[] = payload.results;
  const first = rows[0];
  return first && typeof first === "object" ? { ...first } : undefined;
}
/** Existing list fixtures retain one server snapshot for the separate real detail request. */
function recordRoutes(routes: FakeApiRoutes) {
  let latest: Record<string, unknown> = motorcycle();
  const list = routes[GET] ?? pageOf();
  return {
    ...routes,
    [GET]: async (request: RecordedRequest) => {
      const reply = typeof list === "function" ? await list(request) : list.clone();
      if (reply.ok) {
        const payload: unknown = await reply.clone().json();
        const first = firstRecord(payload);
        if (first) latest = first;
      }
      return reply;
    },
    [`GET /api/v1/motorcycles/${motorcycle().id}/`]:
      routes[`GET /api/v1/motorcycles/${motorcycle().id}/`] ??
      (() => Response.json({ ...motorcycleDetail(), ...latest })),
  };
}
export async function openFleet(
  options: {
    path?: string;
    me?: typeof ALLOWED;
    routes?: FakeApiRoutes;
    language?: "en" | "es-MX";
  } = {},
) {
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(options.me ?? ALLOWED),
    "GET /api/v1/catalogs/void-reason/items/": Response.json({
      count: 3,
      next: null,
      previous: null,
      results: makeVoidReasonItems(),
    }),
    [`GET /api/v1/motorcycles/${motorcycle().id}/services/`]: () => historyPage([serviceRecord()]),
    [`GET /api/v1/motorcycles/${motorcycle().id}/responsibility-letters/`]: () => historyPage([]),
    "GET /api/v1/fuel-loads/": () => historyPage([fuelLoad()]),
    "GET /api/v1/incidents/": () => historyPage([]),
    ...recordRoutes(options.routes ?? {}),
  });
  const reads: FleetRead[] = [];
  const app = await renderApp({
    path: options.path ?? LIST,
    fetch: traceFleetReads(evidenceFetch(api, options.routes ?? {}), reads),
    language: options.language ?? "es-MX",
  });
  return { api, app, reads };
}
export function settleFleet(
  opened: Awaited<ReturnType<typeof openFleet>>,
  options: {
    since: number;
    me?: typeof ALLOWED;
    center?: string;
    kind?: "list" | "record" | HistoryTarget;
    params?: Readonly<Record<string, string>>;
  },
) {
  const kind = options.kind ?? "record";
  const target: FleetReadTarget =
    kind === "list"
      ? { kind, ...(options.params ? { params: options.params } : {}) }
      : kind === "record"
        ? { kind, code: "M-03", id: motorcycle().id }
        : { kind: "history", id: motorcycle().id, tab: kind };
  return acceptFleetRead({
    client: opened.app.queryClient,
    me: options.me ?? ALLOWED,
    reads: opened.reads,
    since: options.since,
    target,
    ...(options.center ? { center: options.center } : {}),
  });
}
type HistoryTarget = "services" | "responsibility" | "fuel" | "incidents";

/** The shared void dialog (#80) asks for a catalog reason first; "Other" shows the free-text field. */
export async function otherReasonField(): Promise<HTMLTextAreaElement> {
  const dialog = within(await screen.findByRole("dialog"));
  await userEvent.selectOptions(await dialog.findByRole("combobox"), "other");
  return dialog.getByRole<HTMLTextAreaElement>("textbox");
}
