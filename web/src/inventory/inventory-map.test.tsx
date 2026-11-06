import { act, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Schemas } from "@wolbachia/api-client";
import { openInventory } from "../test/inventory-api";
import { inventoryLocation, inventoryPage } from "../test/inventory-fixtures";
vi.mock("./locations/LocationMapCanvas", () => ({
  LocationMapCanvas: ({ locations }: { locations: Schemas["Location"][] }) => (
    <output aria-label="Mapped locations">{locations.map((row) => row.code).join(",")}</output>
  ),
}));
afterEach(() => {
  vi.unstubAllGlobals();
});

test("the map and table replace the same accepted server page without loading the entire catalog", async () => {
  vi.stubGlobal(
    "WebGL2RenderingContext",
    class {
      readonly synthetic = true;
    },
  );
  const second = inventoryLocation({ id: "second-location", code: "LOC-02" });
  const { app, api } = await openInventory({
    path: "/inventory/locations",
    routes: {
      "GET /api/v1/locations/": (request) =>
        Response.json(
          inventoryPage([request.path.includes("page=2") ? second : inventoryLocation()], 26),
        ),
    },
  });
  expect((await screen.findByLabelText("Mapped locations")).textContent).toBe("LOC-01");
  await act(async () => {
    await app.router.navigate({ to: "/inventory/locations", search: { page: "2" } });
  });
  await screen.findByRole("link", { name: "LOC-02" });
  expect(screen.getByLabelText("Mapped locations").textContent).toBe("LOC-02");
  expect(screen.queryByRole("link", { name: "LOC-01" })).toBeNull();
  expect(
    api.requests
      .filter((request) => request.path.startsWith("/api/v1/locations/?"))
      .every((request) => request.path.includes("page_size=25")),
  ).toBe(true);
});
test("missing WebGL leaves the scoped table and coordinates usable", async () => {
  vi.stubGlobal("WebGL2RenderingContext", undefined);
  await openInventory({ path: "/inventory/locations" });
  await screen.findByText("Mapa no disponible. La lista y las coordenadas siguen disponibles.");
  expect(await screen.findByRole("link", { name: "LOC-01" })).toBeDefined();
  expect(screen.getByText("-99, 19")).toBeDefined();
});
