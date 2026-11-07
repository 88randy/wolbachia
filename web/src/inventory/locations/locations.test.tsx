import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { openInventory } from "../../test/inventory-api";
import {
  inventoryLocation,
  inventoryLot,
  inventoryPage,
  INVENTORY_OWNER,
  INVENTORY_CENTER,
  INVENTORY_OPERATION,
  INVENTORY_ADMISSION,
} from "../../test/inventory-fixtures";

test("a physical stock quantity links to actual server-filtered legs using the operation UUID", async () => {
  const location = inventoryLocation();
  const lot = inventoryLot();
  const user = userEvent.setup();
  const { api, app } = await openInventory({
    path: "/inventory/locations/LOC-01",
    routes: {
      [`GET /api/v1/locations/${location.id}/stock/`]: () =>
        Response.json(
          inventoryPage([
            {
              lot: lot.id,
              lot_code: lot.code,
              supply: lot.supply,
              piece_id: null,
              quantity: "2",
              unit: "piece",
              source_ids: [INVENTORY_OPERATION],
            },
          ]),
        ),
      [`GET /api/v1/locations/${location.id}/movements/`]: () =>
        Response.json(
          inventoryPage([
            {
              id: "movement",
              operation_id: INVENTORY_OPERATION,
              line_number: 1,
              lot_id: lot.id,
              lot_code: lot.code,
              supply_id: lot.supply,
              location_id: location.id,
              location_code: location.code,
              piece_id: null,
              quantity: "2",
              unit: "piece",
              unit_version_id: lot.supply_version_id,
              source_kind: "lot_admission",
              source_id: INVENTORY_ADMISSION,
              created_at: "2026-11-06T12:00:00Z",
              created_by: null,
            },
          ]),
        ),
    },
  });
  await user.click(await screen.findByRole("link", { name: "2" }));
  await waitFor(() => {
    expect(
      api.requests.some(
        (request) =>
          request.path.includes("/movements/") &&
          request.path.includes(`lot=${lot.id}`) &&
          request.path.includes("piece=none") &&
          request.path.includes("unit=piece"),
      ),
    ).toBe(true);
  });
  await user.click(await screen.findByRole("link", { name: INVENTORY_OPERATION }));
  await waitFor(() => {
    expect(
      api.requests.some((request) => request.path.includes(`operation=${INVENTORY_OPERATION}`)),
    ).toBe(true);
  });
  expect(
    api.requests.some((request) => request.path.includes(`operation=${INVENTORY_ADMISSION}`)),
  ).toBe(false);
  expect(screen.getByText(INVENTORY_ADMISSION)).toBeDefined();
  const beforeClear = api.requests.length;
  await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  await waitFor(() => {
    expect(
      api.requests
        .slice(beforeClear)
        .some(
          (request) =>
            request.path.includes("/movements/") &&
            !new URL(request.path, "https://test.invalid").searchParams.has("operation") &&
            !new URL(request.path, "https://test.invalid").searchParams.has("lot"),
        ),
    ).toBe(true);
  });
  expect(app.router.state.location.search).toMatchObject({
    view: "movements",
    center: location.center,
  });
  await user.click(screen.getByRole("tab", { name: "Existencias" }));
  await screen.findByRole("link", { name: "2" });
  expect(app.router.state.location.search).toMatchObject({
    view: "stock",
    center: location.center,
  });
});

test("location creation uses actual center-only placement and Membership owner, retaining unknown safety", async () => {
  const user = userEvent.setup();
  const { api } = await openInventory({
    path: "/inventory/locations",
    routes: {
      "GET /api/v1/locations/placement-options/": () =>
        Response.json(inventoryPage([{ kind: "center_only", quadrant_id: null, code: null }])),
      "POST /api/v1/locations/": () => Response.json(inventoryLocation(), { status: 201 }),
    },
  });
  await user.click(await screen.findByRole("button", { name: "Nueva ubicación" }));
  const dialog = within(screen.getByRole("dialog"));
  await user.type(dialog.getByRole("textbox", { name: "Código" }), "LOC-NEW");
  await user.type(dialog.getByRole("textbox", { name: "Nombre" }), "Authored store");
  await user.selectOptions(
    dialog.getByRole("combobox", { name: "Tipo de ubicación" }),
    "warehouse",
  );
  await dialog.findByRole("option", { name: "Synthetic center" });
  await user.selectOptions(dialog.getByRole("combobox", { name: "Centro" }), INVENTORY_CENTER);
  await dialog.findByRole("option", { name: "Sólo centro, sin cuadrante" });
  await user.selectOptions(dialog.getByRole("combobox", { name: "Cuadrante" }), "none");
  await dialog.findByRole("option", { name: "Synthetic owner" });
  await user.selectOptions(dialog.getByRole("combobox", { name: "Responsable" }), INVENTORY_OWNER);
  await user.type(dialog.getByRole("textbox", { name: "Longitud" }), "-99.2");
  await user.type(dialog.getByRole("textbox", { name: "Latitud" }), "   ");
  await user.click(dialog.getByRole("button", { name: "Crear registro" }));
  await dialog.findByRole("alert");
  expect(api.requests.some((request) => request.method === "POST")).toBe(false);
  await user.clear(dialog.getByRole("textbox", { name: "Latitud" }));
  await user.type(dialog.getByRole("textbox", { name: "Latitud" }), "19.3");
  await user.click(dialog.getByRole("button", { name: "Crear registro" }));
  await screen.findByText("Guardado en el servidor");
  expect(api.requests.find((request) => request.method === "POST")?.body).toMatchObject({
    owner_id: INVENTORY_OWNER,
    center_id: INVENTORY_CENTER,
    quadrant_id: null,
    is_insecticide_free: null,
    geometry: { type: "Point", coordinates: [-99.2, 19.3] },
  });
});

test("a lost location write reconciles only equivalent submitted coordinates, without replay", async () => {
  const user = userEvent.setup();
  let current = inventoryLocation();
  const { api } = await openInventory({
    path: "/inventory/locations/LOC-01",
    routes: {
      "GET /api/v1/locations/": () => Response.json(inventoryPage([current])),
      [`GET /api/v1/locations/${current.id}/stock/`]: () => Response.json(inventoryPage([])),
      [`PATCH /api/v1/locations/${current.id}/`]: () => {
        current = {
          ...current,
          revision: 2,
          geometry: { type: "Point", coordinates: [-99.2, 19.4] },
        };
        throw new TypeError("Synthetic lost response");
      },
    },
  });
  const longitude = await screen.findByRole("textbox", { name: "Longitud" });
  await user.clear(longitude);
  await user.type(longitude, "-99.100000");
  const latitude = screen.getByRole("textbox", { name: "Latitud" });
  await user.clear(latitude);
  await user.type(latitude, "19.400000");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  const reconcile = await screen.findByRole("button", { name: "Consultar el registro guardado" });
  await user.click(reconcile);
  await waitFor(() => {
    expect(
      api.requests.filter((request) => request.path.startsWith("/api/v1/locations/?")).length,
    ).toBeGreaterThan(1);
  });
  expect(
    screen.getByRole("button", { name: "Guardar cambios" }).getAttribute("aria-disabled"),
  ).toBe("true");
  current = { ...current, geometry: { type: "Point", coordinates: [-99.1, 19.4] } };
  await user.click(reconcile);
  await screen.findByText("Guardado en el servidor");
  expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1);
});
