import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { openInventory } from "../../test/inventory-api";
import {
  inventoryLocation,
  inventoryLot,
  inventoryPage,
  inventoryMovement,
  INVENTORY_OWNER,
  INVENTORY_CENTER,
  INVENTORY_OPERATION,
  INVENTORY_ADMISSION,
} from "../../test/inventory-fixtures";
import "../../test/slow-app-flows";

const PIN = [-99.1, 19.4];

/** A Combobox stays disabled until the choice it depends on is made; wait for that, then use it. */
async function enabledPicker(scope: HTMLElement, name: string) {
  const picker = await within(scope).findByRole<HTMLButtonElement>("combobox", { name });
  await waitFor(() => {
    expect(picker.disabled).toBe(false);
  });
  return picker;
}

// MapLibre needs WebGL, which jsdom lacks. The map picker is replaced by a stand-in that places
// the pin the same way a click on the map does: through onChange([longitude, latitude]).
vi.mock("../../map-picker/MapPointPicker", () => ({
  MapPointPicker: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number[] | null;
    onChange: (point: number[]) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          onChange(PIN);
        }}
      >
        {"Colocar punto: " + label}
      </button>
      <output aria-label="Punto actual">{value ? value.join(",") : "sin punto"}</output>
    </div>
  ),
}));

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
  await screen.findByRole("cell", { name: "Admisión inicial" });
  // The operation id is a URL-only facet: it reaches the server as given, never as the admission id.
  await act(async () => {
    await app.router.navigate({
      to: "/inventory/locations/$code",
      params: { code: location.code },
      search: {
        view: "movements",
        center: location.center,
        operation: INVENTORY_OPERATION,
        lot: lot.id,
      },
    });
  });
  await waitFor(() => {
    expect(
      api.requests.some((request) => request.path.includes(`operation=${INVENTORY_OPERATION}`)),
    ).toBe(true);
  });
  expect(
    api.requests.some((request) => request.path.includes(`operation=${INVENTORY_ADMISSION}`)),
  ).toBe(false);
  expect(screen.queryByText(INVENTORY_ADMISSION)).toBeNull();
  await user.click(screen.getByRole("button", { name: /Cantidad/ }));
  await user.click(screen.getByRole("button", { name: /Cantidad/ }));
  await waitFor(() => {
    expect(
      api.requests.some((request) => {
        const url = new URL(request.path, "https://test.invalid");
        return (
          url.pathname === `/api/v1/locations/${location.id}/movements/` &&
          url.searchParams.get("ordering") === "-quantity" &&
          url.searchParams.get("operation") === INVENTORY_OPERATION &&
          url.searchParams.get("lot") === lot.id
        );
      }),
    ).toBe(true);
  });
  expect(app.router.state.location.search).toMatchObject({
    view: "movements",
    center: location.center,
    ordering: "-quantity",
    operation: INVENTORY_OPERATION,
    lot: lot.id,
  });
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
  const transferId = "cd000000-0000-0000-0000-000000000010";
  const dispatchEvent = "cd000000-0000-0000-0000-000000000011";
  const rows = [
    inventoryMovement(),
    inventoryMovement({
      id: "cd000000-0000-0000-0000-000000000012",
      operation_id: "cd000000-0000-0000-0000-000000000013",
      source_kind: "transfer_dispatch",
      source_id: dispatchEvent,
      quantity: "-2",
      source_transfer: { id: transferId, code: "TR-01", event_id: dispatchEvent },
    }),
    inventoryMovement({
      id: "cd000000-0000-0000-0000-000000000014",
      operation_id: "cd000000-0000-0000-0000-000000000015",
      source_kind: "transfer_receive",
      source_id: "cd000000-0000-0000-0000-000000000016",
      source_transfer: null,
    }),
    inventoryMovement({
      id: "cd000000-0000-0000-0000-000000000017",
      operation_id: "cd000000-0000-0000-0000-000000000018",
      source_kind: "transfer_resolution",
      source_id: "cd000000-0000-0000-0000-000000000019",
      quantity: "-1",
    }),
    {
      ...inventoryMovement({
        id: "cd000000-0000-0000-0000-000000000020",
        operation_id: "cd000000-0000-0000-0000-000000000021",
        source_id: "cd000000-0000-0000-0000-000000000022",
      }),
      source_kind: "future_source",
    },
  ];
  api.setRoute(`GET /api/v1/locations/${location.id}/movements/`, () =>
    Response.json(inventoryPage(rows)),
  );
  await user.click(screen.getByRole("tab", { name: "Movimientos" }));
  for (const label of [
    "Admisión inicial",
    "Salida de transferencia",
    "Recepción de transferencia",
    "Resolución de transferencia",
    "Origen no reconocido",
  ])
    await screen.findByText(label);
  const dispatchRow = screen.getByText(/TR-01/).closest("tr");
  expect(dispatchRow).not.toBeNull();
  if (!dispatchRow) throw new Error("Expected the rendered dispatch movement row");
  const dispatch = within(dispatchRow);
  expect(dispatch.getByText("Salida de transferencia")).toBeDefined();
  // Ids are never shown to the user and the transfer code is not a link: no transfer read happens.
  expect(screen.queryByText(transferId)).toBeNull();
  expect(screen.queryByText(dispatchEvent)).toBeNull();
  expect(screen.queryByRole("link", { name: /TR-01/ })).toBeNull();
  expect(api.requests.some((request) => request.path.startsWith("/api/v1/transfers/"))).toBe(false);
  const lotLink = dispatch.getByRole("link", { name: lot.code });
  expect(
    new URL(lotLink.getAttribute("href") ?? "", "https://test.invalid").searchParams.get(
      "custody_location",
    ),
  ).toBe(location.id);
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
  const dialogElement = screen.getByRole("dialog");
  const dialog = within(dialogElement);
  await user.type(dialog.getByRole("textbox", { name: "Código" }), "LOC-NEW");
  await user.type(dialog.getByRole("textbox", { name: "Nombre" }), "Authored store");
  await user.selectOptions(dialog.getByRole("combobox", { name: "Tipo de ubicación" }), "Almacén");
  await user.selectOptions(dialog.getByRole("combobox", { name: "Centro" }), "Synthetic center");
  await user.selectOptions(
    await enabledPicker(dialogElement, "Cuadrante"),
    "Sólo centro, sin cuadrante",
  );
  await user.selectOptions(await enabledPicker(dialogElement, "Responsable"), "Synthetic owner");
  await user.click(dialog.getByRole("button", { name: "Crear registro" }));
  await dialog.findByRole("alert");
  expect(api.requests.some((request) => request.method === "POST")).toBe(false);
  await user.click(dialog.getByRole("button", { name: /Colocar punto/ }));
  expect(dialog.getByLabelText("Punto actual").textContent).toBe("-99.1,19.4");
  await user.click(dialog.getByRole("button", { name: "Crear registro" }));
  await screen.findByText("Guardado");
  expect(api.requests.find((request) => request.method === "POST")?.body).toMatchObject({
    owner_id: INVENTORY_OWNER,
    center_id: INVENTORY_CENTER,
    quadrant_id: null,
    is_insecticide_free: null,
    geometry: { type: "Point", coordinates: [-99.1, 19.4] },
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
  await user.click(await screen.findByRole("button", { name: /Colocar punto/ }));
  expect(screen.getByLabelText("Punto actual").textContent).toBe("-99.1,19.4");
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
  await screen.findByText("Guardado");
  expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1);
});
