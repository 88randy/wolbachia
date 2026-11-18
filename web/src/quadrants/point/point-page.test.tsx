import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ALLOWED,
  BLOCK_ID,
  POLYGON,
  openGeography,
  pageOf,
  version,
} from "../geography/geography-test-helpers";
import { TRAP_ID, makeEntry, makeReading, makeTrap } from "./point-fixtures";

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

const PATH = "/quadrants/C-07/points/OV-010";
const reader = {
  ...ALLOWED,
  permissions: [...ALLOWED.permissions, "ovitrap.read", "reading.read"],
};
const voidedReading = makeReading({
  id: "00000000-0000-4000-8000-0000000000b2",
  bag_code: "B-030",
  device_time: "2026-11-04T16:00:00Z",
  voided_at: "2026-11-05T10:00:00Z",
  void_reason: "Lectura duplicada",
});

function routes() {
  return {
    [`GET /api/v1/blocks/${BLOCK_ID}/`]: Response.json({
      id: BLOCK_ID,
      code: "B-1",
      current_version: { ...version(), geometry: POLYGON },
    }),
    "GET /api/v1/ovitraps/": pageOf([makeTrap()]),
    [`GET /api/v1/ovitraps/${TRAP_ID}/history/`]: Response.json({
      ovitrap: TRAP_ID,
      point_code: "OV-010",
      suggest_relocation: false,
      entries: [makeEntry()],
    }),
    "GET /api/v1/readings/": pageOf([makeReading(), voidedReading]),
  };
}

async function openPoint(me = reader, extra = {}) {
  window.sessionStorage.clear();
  return openGeography({
    path: PATH,
    language: "en",
    me,
    routes: { ...routes(), ...extra },
  });
}

beforeEach(() => {
  vi.stubEnv("VITE_MAP_TILES_URL", "");
  vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {
    return null;
  });
});

describe("Sampling point page", () => {
  test("shows the point, its coordinates, the current ovitrap, the history and the bags", async () => {
    await openPoint();
    await screen.findByRole("heading", { name: "Point OV-010" });
    const data = screen.getByRole("region", { name: "Point details" });
    expect(within(data).getByText("C-07")).toBeDefined();
    expect(within(data).getAllByText("3.000000")).toBeDefined();
    expect(await within(data).findByText(/OVT-0042, installed on/)).toBeDefined();
    const history = screen.getByRole("region", { name: "What has happened at this point" });
    expect(await within(history).findByText("Ovitrap OVT-0042 was installed")).toBeDefined();
    expect(within(history).getByText("Check of ovitrap OVT-0042")).toBeDefined();
    expect(within(history).getByText("Yes")).toBeDefined();
    const bags = screen.getByRole("region", { name: "Bags collected here" });
    expect(within(bags).getByRole("button", { name: "View origin of bag B-031" })).toBeDefined();
    expect(await screen.findByRole("img", { name: "Sampling point OV-010" })).toBeDefined();
  });

  test("voided checks and their bags are hidden until asked for, then struck through with the reason", async () => {
    await openPoint();
    const bags = await screen.findByRole("region", { name: "Bags collected here" });
    expect(within(bags).queryByText("B-030")).toBeNull();
    await userEvent.click(screen.getByRole("switch", { name: "Show voided" }));
    expect(within(bags).getByText("B-030")).toBeDefined();
    expect(within(bags).getByText("Reason: Lectura duplicada")).toBeDefined();
    expect(within(bags).getAllByText("Voided").length).toBeGreaterThan(0);
  });

  test("without ovitrap and reading permissions the page hides the history and asks for neither", async () => {
    const { api } = await openPoint(ALLOWED);
    await screen.findByRole("heading", { name: "Point OV-010" });
    expect(screen.queryByRole("region", { name: "What has happened at this point" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Bags collected here" })).toBeNull();
    expect(api.requests.some(({ path }) => path.startsWith("/api/v1/readings/"))).toBe(false);
    expect(api.requests.some(({ path }) => path.startsWith("/api/v1/ovitraps/"))).toBe(false);
  });

  test("a point that is not in that quadrant looks like any missing page", async () => {
    await openPoint(reader, { "GET /api/v1/sampling-points/": pageOf() });
    await screen.findByRole("heading", { name: "We couldn't find this page" });
  });

  test("the points list of the quadrant links to the point page by human codes", async () => {
    await openGeography({
      path: "/quadrants/C-07/versions?view=points",
      language: "en",
      me: reader,
      routes: routes(),
    });
    const link = await screen.findByRole("link", { name: "View point OV-010" });
    expect(link.getAttribute("href")).toBe(PATH);
  });
});
