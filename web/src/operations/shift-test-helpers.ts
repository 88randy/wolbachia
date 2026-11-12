import type { Schemas } from "@wolbachia/api-client";
import { createFakeApi, makeMe } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { renderApp } from "../test/render-app";

export const SHIFT_ID = "00000000-0000-4000-8000-000000000034";
export const DETAIL = "/api/v1/shifts/" + SHIFT_ID + "/";
export const SHIFT_PATH = "/operations/shifts/" + SHIFT_ID;
export const ALLOWED = makeMe({ permissions: ["shift.read", "shift.validate"] });
const EMPTY_VALIDATION: Schemas["ShiftDetail"]["validation"] = {
  revision: 0,
  latest_decision: null,
  kind: null,
  approval_current: false,
  blockers: [],
};

export function shiftDetail(
  overrides: Partial<Schemas["ShiftDetail"]> = {},
): Schemas["ShiftDetail"] {
  return {
    id: SHIFT_ID,
    courier: "00000000-0000-4000-8000-000000000001",
    device: "00000000-0000-4000-8000-000000000002",
    motorcycle: "00000000-0000-4000-8000-000000000003",
    motorcycle_code: "M-03",
    status: "closed",
    opened_at_device: "2026-11-03T14:12:00Z",
    opened_event: "00000000-0000-4000-8000-000000000004",
    odometer_open_km: 12480,
    open_note: "Synthetic opening",
    closed_at_device: "2026-11-03T20:40:00Z",
    closed_event: "00000000-0000-4000-8000-000000000005",
    odometer_close_km: 12521,
    close_note: "Synthetic closing",
    checks: [],
    created_at: "2026-11-03T14:13:00Z",
    validation: EMPTY_VALIDATION,
    validation_timeline: [],
    ...overrides,
  };
}

export function decision(kind: "approve" | "observe"): Schemas["ShiftDecision"] {
  return {
    id: "00000000-0000-4000-8000-000000000006",
    shift: SHIFT_ID,
    closed_event: shiftDetail().closed_event ?? "",
    revision: 1,
    expected_revision: 0,
    kind,
    reason: "Reviewed synthetic shift",
    validation_fingerprint: "synthetic-fingerprint",
    subjects: [],
    created_by: ALLOWED.user.id,
    created_by_name: "Ana Supervisora",
    created_at: "2026-11-04T15:00:00Z",
  };
}

export async function openShift(
  options: {
    shift?: Schemas["ShiftDetail"];
    routes?: FakeApiRoutes;
    permissions?: string[];
    path?: string;
  } = {},
) {
  const api = createFakeApi({
    "GET /api/v1/me/": () =>
      Response.json({
        ...ALLOWED,
        permissions: options.permissions ?? ALLOWED.permissions,
      }),
    ["GET " + DETAIL]: () => Response.json(options.shift ?? shiftDetail()),
    ...options.routes,
  });
  const app = await renderApp({ path: options.path ?? SHIFT_PATH, fetch: api.fetch });
  return { ...app, api };
}
