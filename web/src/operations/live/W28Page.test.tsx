import { screen, waitFor } from "@testing-library/react";
import type { Schemas } from "@wolbachia/api-client";
import { afterEach, expect, test, vi } from "vitest";
import { apiError, createFakeApi, makeMe } from "../../test/fake-api";
import type { FakeApiRoutes } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";

const LUIS = "00000000-0000-4000-8000-0000000000a1";
const ROSA = "00000000-0000-4000-8000-0000000000b2";
const PEDRO = "00000000-0000-4000-8000-0000000000c3";
const TRACKING = ["shift.read", "courier_track.read"];
const POSITIONS = "GET /api/v1/shifts/positions/";
const shiftIdOf = (courier: string) => courier.replace("0000000000", "1111111111");
const TRACK = "GET /api/v1/shifts/" + shiftIdOf(LUIS) + "/track/";

function shift(courier: string, code: string): Schemas["Shift"] {
  return {
    id: shiftIdOf(courier),
    code,
    courier,
    device: "00000000-0000-4000-8000-000000000002",
    motorcycle: "00000000-0000-4000-8000-000000000003",
    motorcycle_code: "M-03",
    status: "open",
    opened_at_device: "2026-11-24T14:00:00Z",
    opened_event: "00000000-0000-4000-8000-000000000004",
    odometer_open_km: 100,
    open_note: "",
    closed_at_device: null,
    closed_event: null,
    odometer_close_km: null,
    close_note: "",
    checks: [],
    created_at: "2026-11-24T14:00:00Z",
  };
}

function position(courier: string, minutesAgo: number): Schemas["LastPosition"] {
  // Seconds of slack keep the whole minutes stable while the test runs.
  const recorded = new Date(Date.now() - minutesAgo * 60_000 - 5_000).toISOString();
  return {
    shift_id: shiftIdOf(courier),
    shift_code: "JOR-1",
    courier,
    motorcycle_code: "M-03",
    lat: 19.4,
    lng: -99.1,
    accuracy_m: 8,
    recorded_at: recorded,
    received_at: recorded,
  };
}

const page = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

async function openLive(options: { permissions: string[]; path?: string; routes?: FakeApiRoutes }) {
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(makeMe({ permissions: options.permissions })),
    "GET /api/v1/shifts/": () =>
      Response.json(page([shift(LUIS, "JOR-1"), shift(ROSA, "JOR-2"), shift(PEDRO, "JOR-3")])),
    "GET /api/v1/quadrant-assignments/": () => Response.json(page([])),
    "GET /api/v1/quadrants/": () => Response.json(page([])),
    "GET /api/v1/lookups/users/": () =>
      Response.json(
        page([
          { id: LUIS, display_name: "Luis", is_courier: true },
          { id: ROSA, display_name: "Rosa", is_courier: true },
          { id: PEDRO, display_name: "Pedro", is_courier: true },
        ]),
      ),
    [POSITIONS]: () => Response.json([position(LUIS, 2), position(ROSA, 15)]),
    [TRACK]: () =>
      Response.json({
        shift_id: shiftIdOf(LUIS),
        status: "open",
        segments: [],
        pending_review_count: 0,
      }),
    ...options.routes,
  });
  const app = await renderApp({ path: options.path ?? "/operations/live", fetch: api.fetch });
  await screen.findByText("Luis");
  return { ...app, api };
}

const calls = (requests: { method: string; path: string }[], key: string) =>
  requests.filter((request) => `${request.method} ${request.path.split("?")[0] ?? ""}` === key)
    .length;

afterEach(() => {
  vi.useRealTimers();
});

test("without courier_track.read no position is asked for or shown", async () => {
  const { api } = await openLive({ permissions: ["shift.read"] });
  expect(screen.getByText("Rosa")).toBeDefined();
  expect(calls(api.requests, POSITIONS)).toBe(0);
  expect(screen.queryByText(/Última posición|Sin posición nueva|Todavía no recibimos/)).toBeNull();
  expect(screen.queryByText(/Punto hueco/)).toBeNull();
});

test("each courier shows the age of its last position; a stale one says so in words", async () => {
  const { api } = await openLive({ permissions: TRACKING });
  const recent = await screen.findByText("Última posición: hace 2 min");
  expect(recent.tagName).toBe("TIME");
  expect(recent.getAttribute("dateTime")).not.toBeNull();
  expect(screen.getByText("Sin posición nueva: hace 15 min")).toBeDefined();
  expect(screen.getByText("Todavía no recibimos su posición.")).toBeDefined();
  expect(
    screen.getByText("Punto hueco y punteado: sin posición nueva en más de 10 min."),
  ).toBeDefined();
  // No courier is focused, so no track is loaded.
  expect(calls(api.requests, TRACK)).toBe(0);
});

test("focusing a courier loads that shift's track once and refreshes it every 2 minutes", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { api } = await openLive({
    permissions: TRACKING,
    path: `/operations/live?courier=${LUIS}`,
  });
  await waitFor(() => {
    expect(calls(api.requests, TRACK)).toBe(1);
  });
  await vi.advanceTimersByTimeAsync(119_000);
  expect(calls(api.requests, TRACK)).toBe(1);
  await vi.advanceTimersByTimeAsync(2_000);
  await waitFor(() => {
    expect(calls(api.requests, TRACK)).toBe(2);
  });
  // Only the focused courier's track is ever asked for.
  expect(api.requests.filter((request) => request.path.includes("/track/"))).toHaveLength(2);
});

test("a failed track read keeps the board and explains the retry", async () => {
  await openLive({
    permissions: TRACKING,
    path: `/operations/live?courier=${LUIS}`,
    routes: { [TRACK]: apiError(500, "server_error") },
  });
  expect(
    await screen.findByText(
      "No pudimos cargar el recorrido de este repartidor. Se reintentará cada 2 minutos.",
    ),
  ).toBeDefined();
  expect(screen.getByText("Última posición: hace 2 min")).toBeDefined();
});
