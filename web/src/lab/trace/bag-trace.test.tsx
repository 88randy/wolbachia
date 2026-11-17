import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { count, openCount, pageOf } from "../count-test-helpers";
import { makeTrace } from "./trace-fixtures";
import type { BagTrace } from "./trace-query";

vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/map-worker-test.js",
}));
// jsdom has no WebGL: the engine is faked, the markers and their labels are the real ones.
vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div role="region" aria-label="engine">
      {children}
    </div>
  ),
  Source: () => null,
  Layer: () => null,
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const TRACE_ROUTE = "GET /api/v1/bags/B-031/trace/";
const reader = ["egg_count.create", "egg_count.read", "catalog.read", "reading.read"];
const trace =
  (overrides: Partial<BagTrace> = {}) =>
  () =>
    Response.json(makeTrace(overrides));

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("VITE_MAP_TILES_URL", "");
  vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {
    return null;
  });
});

async function openHistoryDrawer(permissions: string[], overrides: Partial<BagTrace> = {}) {
  const opened = await openCount({
    history: true,
    language: "en",
    permissions,
    routes: {
      "GET /api/v1/egg-counts/": () => pageOf([count({ bag_code: "B-031" })]),
      [TRACE_ROUTE]: trace(overrides),
    },
  });
  return opened;
}

describe("Egg paddle origin", () => {
  test("a bag code in a list opens the full origin with timeline, facts, map markers and coordinates", async () => {
    await openHistoryDrawer(reader);
    await userEvent.click(await screen.findByRole("button", { name: "View origin of bag B-031" }));
    const drawer = await screen.findByRole("dialog", { name: "Origin of bag B-031" });
    const story = within(drawer).getByRole("region", { name: "What happened to the paddle" });
    expect(within(story).getAllByRole("listitem")).toHaveLength(7);
    expect(within(story).getByText("Paddle put in the trap")).toBeDefined();
    expect(within(story).getAllByText(/by Ana Laboratorio/).length).toBeGreaterThan(0);
    const facts = within(drawer).getByRole("region", { name: "Trap details" });
    expect(within(facts).getByText("OVT-0042")).toBeDefined();
    expect(within(facts).getByText("Q-MER-01-B1-P1")).toBeDefined();
    expect(within(facts).getByText("7")).toBeDefined();
    expect(
      await within(drawer).findByRole("img", { name: "Sampling point Q-MER-01-B1-P1" }),
    ).toBeDefined();
    expect(within(drawer).getByRole("img", { name: "Courier reading" })).toBeDefined();
    const table = within(drawer).getByRole("table", { name: "Coordinates" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  test("a voided count is struck through with its reason", async () => {
    await openHistoryDrawer(reader);
    await userEvent.click(await screen.findByRole("button", { name: "View origin of bag B-031" }));
    const drawer = await screen.findByRole("dialog", { name: "Origin of bag B-031" });
    const struck = await within(drawer).findByText("Egg count 1");
    expect(struck.className).toContain("line-through");
    expect(within(drawer).getByText(/Reason: Error al capturar/)).toBeDefined();
  });

  test("without lab permission the field steps still show and the lab steps say why they are missing", async () => {
    await openHistoryDrawer(reader, { lab: null });
    await userEvent.click(await screen.findByRole("button", { name: "View origin of bag B-031" }));
    const drawer = await screen.findByRole("dialog", { name: "Origin of bag B-031" });
    await within(drawer).findByText("You do not have permission to see the lab steps.");
    expect(within(drawer).queryByText("Arrived at the lab")).toBeNull();
  });

  test("without reading.read the code is plain text and nothing is requested", async () => {
    const { api } = await openHistoryDrawer(["egg_count.create", "egg_count.read", "catalog.read"]);
    await screen.findByText("B-031");
    expect(screen.queryByRole("button", { name: "View origin of bag B-031" })).toBeNull();
    expect(api.requests.some((request) => request.path.includes("/trace/"))).toBe(false);
  });

  test("the count screen shows the compact origin and opens the map only on request", async () => {
    await openCount({
      language: "en",
      permissions: reader,
      routes: { [TRACE_ROUTE]: trace() },
    });
    const card = await screen.findByRole("region", { name: "Egg paddle origin" });
    expect(
      within(card).getByText(/OVT-0042 · Q-MER-01-B1-P1 · Q-MER-01-B1 · Q-MER-01 · Mérida/),
    ).toBeDefined();
    expect(within(card).getByText("Days in the field: 7")).toBeDefined();
    expect(within(card).queryByRole("img", { name: /Sampling point/ })).toBeNull();
    await userEvent.click(within(card).getByRole("button", { name: "Show map" }));
    await waitFor(() => {
      expect(
        within(card).getByRole("img", { name: "Sampling point Q-MER-01-B1-P1" }),
      ).toBeDefined();
    });
  });

  test("a bag outside the user's scope says it was not found instead of failing the screen", async () => {
    await openCount({
      language: "en",
      permissions: reader,
      routes: {
        [TRACE_ROUTE]: () => Response.json({ code: "not_found", params: {} }, { status: 404 }),
      },
    });
    await screen.findByText("We could not find that bag, or you do not have access to it.");
    expect(
      screen.getByRole("textbox", { name: /How many eggs|¿Cuántos huevos contaste?/ }),
    ).toBeDefined();
  });
});
