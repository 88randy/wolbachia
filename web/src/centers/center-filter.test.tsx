import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { messages } from "@wolbachia/i18n";
import type { MapProps } from "../quadrants/geography/map-types";
import { quadrant, pageOf } from "../quadrants/geography/geography-test-helpers";
import { createFakeApi, makeMe } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import { centerStorageKey, writeCenter } from "./center-selection";
vi.mock("../quadrants/geography/GeographyMap", () => ({
  default: ({ quadrants }: MapProps) => (
    <div role="region" aria-label="Map results">
      {quadrants.map((item) => item.code).join(",")}
    </div>
  ),
}));
test("changing A to B clears the URL center and requests only B for the table and map", async () => {
  const centers = [
    { id: "center-a", code: "A", name: "Alpha" },
    { id: "center-b", code: "B", name: "Beta" },
  ];
  const me = makeMe({
    user: { ...makeMe().user, id: "center-map-regression" },
    permissions: ["center.read", "quadrant.read"],
    scope: {
      centers: { mode: "selected", ids: centers.map((center) => center.id) },
      quadrants: { mode: "all", ids: [] },
    },
  });
  writeCenter(centerStorageKey(me), "center-a");
  const a = { ...quadrant(), center: "center-a", code: "Q-A" };
  const b = { ...quadrant(), id: "quadrant-b", center: "center-b", code: "Q-B" };
  let release!: (response: Response) => void;
  const pendingB = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(me),
    "GET /api/v1/centers/": () => pageOf(centers),
    "GET /api/v1/quadrants/": (request) => {
      const center = new URL(request.path, "http://localhost").searchParams.get("center");
      if (center === "center-b") return pendingB;
      return pageOf(center === "center-a" ? [a] : [a, b]);
    },
  });
  const app = await renderApp({ path: "/quadrants?center=center-a", fetch: api.fetch });
  await screen.findByRole("cell", { name: "Q-A" });
  await userEvent.click(
    screen.getByRole("button", { name: messages["es-MX"]["geography.map.open"] }),
  );
  expect((await screen.findByRole("region", { name: "Map results" })).textContent).toBe("Q-A");
  await screen.findByRole("option", { name: "B · Beta" });
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Filtro de centro" }),
    "center-b",
  );
  await waitFor(() => {
    expect(api.requests.some((request) => request.path.includes("center=center-b"))).toBe(true);
  });
  expect(app.router.state.location.search["center"]).toBeUndefined();
  expect(screen.queryByRole("cell", { name: "Q-A" })).toBeNull();
  await act(async () => {
    release(pageOf([b]));
    await pendingB;
  });
  await screen.findByRole("cell", { name: "Q-B" });
  expect(screen.queryByRole("cell", { name: "Q-A" })).toBeNull();
  await userEvent.click(
    screen.getByRole("button", { name: messages["es-MX"]["geography.map.open"] }),
  );
  expect((await screen.findByRole("region", { name: "Map results" })).textContent).toBe("Q-B");
  expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Filtro de centro" }).value).toBe(
    "center-b",
  );
});
