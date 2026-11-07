import { describe, expect, test } from "vitest";
import { lotProtocolOf, protocolValuesOf } from "./inventory-protocol";
import { movementFiltersOf, placementQueryFor } from "./inventory-links";
import {
  inventoryLot,
  inventoryProtocol,
  inventoryLocation,
  inventoryPage,
  inventoryMovement,
  INVENTORY_CENTER,
  INVENTORY_ADMISSION,
} from "../test/inventory-fixtures";
import { openInventory } from "../test/inventory-api";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatInventoryQuantity } from "./format-inventory-quantity";
import { inventoryReadContext } from "./inventory-read-context";

describe("inventory contract mapping", () => {
  test("only absent custody context means admission; a present invalid value never does", () => {
    expect(inventoryReadContext({})).toEqual({ mode: "admission" });
    for (const custody_location of ["", undefined, null, 12, [], {}, "none", "not-a-uuid"])
      expect(inventoryReadContext({ custody_location })).toEqual({ mode: "invalid" });
    expect(
      inventoryReadContext({ custody_location: "CD000000-0000-0000-0000-000000000001" }),
    ).toEqual({ mode: "custody", location: "cd000000-0000-0000-0000-000000000001" });
  });
  test("does not infer a lot protocol from its supply's configured protocol", () => {
    const lot = inventoryLot({ protocol_id: null });
    expect(lot.supply_version.protocol).not.toBeNull();
    expect(lotProtocolOf(lot)).toBeNull();
    expect(lotProtocolOf(inventoryLot())?.id).toBe(inventoryProtocol().id);
  });
  test("does not use an incompatible pin or unreadable protocol arrays", () => {
    expect(lotProtocolOf(inventoryLot({ protocol_id: "different-version" }))).toBeNull();
    expect(protocolValuesOf({ ...inventoryProtocol(), reading_windows: "unknown" })).toBeNull();
    expect(protocolValuesOf(inventoryProtocol())?.reading_windows).toEqual([
      [480, 540],
      [960, 1020],
    ]);
  });
  test("maps null pieces and actual operation IDs without confusing admission IDs", () => {
    expect(movementFiltersOf({ lot: "lot", piece_id: null, unit: "piece" })).toEqual({
      lot: "lot",
      piece: "none",
      unit: "piece",
    });
    expect(placementQueryFor({ kind: "lotUpdate", lot: "lot" })).toEqual({ lot: "lot" });
    expect(placementQueryFor({ kind: "lotCreate", center: "center" })).toEqual({
      action: "lot.create",
      center: "center",
    });
  });
});

test("custody links retain explicit list facets while historical code reads work at zero stock without a lot lookup", async () => {
  const site = "cd000000-0000-0000-0000-000000000005";
  const location = inventoryLocation({ id: site, code: "LOC-B" });
  const admitted = inventoryLot({
    admission_id: INVENTORY_ADMISSION,
    quantity: "100",
    safety_location_id: site,
  });
  const user = userEvent.setup();
  const { api, app } = await openInventory({
    path: `/inventory/lots/LOT-01?custody_location=${site}&center=${INVENTORY_CENTER}`,
    routes: {
      "GET /api/v1/lots/": () => Response.json(inventoryPage([admitted])),
      [`GET /api/v1/lots/${admitted.id}/`]: () => Response.json(admitted),
      "GET /api/v1/locations/": () => Response.json(inventoryPage([location])),
      [`GET /api/v1/locations/${site}/stock/`]: () => Response.json(inventoryPage([])),
      [`GET /api/v1/locations/${site}/movements/`]: () =>
        Response.json(
          inventoryPage([inventoryMovement({ location_id: site, location_code: location.code })]),
        ),
    },
  });
  await screen.findByText("Consulta de custodia · sólo lectura");
  const lookup = api.requests.find(
    (request) => request.path.startsWith("/api/v1/lots/?") && request.path.includes("code=LOT-01"),
  );
  const query = new URL(lookup?.path ?? "", "https://test.invalid").searchParams;
  expect(query.get("custody_location")).toBe(site);
  expect(query.has("center")).toBe(false);
  expect(
    api.requests.some(
      (request) => request.path === `/api/v1/lots/${inventoryLot().id}/?custody_location=${site}`,
    ),
  ).toBe(true);
  expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
  await user.click(screen.getByRole("link", { name: "Volver a la lista" }));
  await screen.findByRole("link", { name: "LOT-01" });
  expect(screen.getByRole("columnheader", { name: /Cantidad inicial de admisión/ })).toBeDefined();
  expect(screen.getByRole("cell", { name: "100" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "100" })).toBeNull();
  expect(app.router.state.location.search).toMatchObject({
    custody_location: site,
    center: INVENTORY_CENTER,
  });
  expect(
    api.requests.some(
      (request) =>
        request.path.includes(`center=${INVENTORY_CENTER}`) &&
        request.path.includes(`custody_location=${site}`),
    ),
  ).toBe(true);
  await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  await waitFor(() => {
    expect(app.router.state.location.search).not.toHaveProperty("center");
  });
  expect(app.router.state.location.search).toHaveProperty("custody_location", site);
  await screen.findByRole("link", { name: "LOT-01" });
  await waitFor(() => {
    expect(app.queryClient.isFetching()).toBe(0);
  });
  const beforeHistory = api.requests.length;
  await act(async () => {
    await app.router.navigate({
      to: "/inventory/locations/$code",
      params: { code: "LOC-B" },
      search: {
        view: "movements",
        custody_location: site,
        lot_code: "LOT-01",
        lot: inventoryLot().id,
      },
    });
  });
  await screen.findByRole("link", { name: inventoryMovement().operation_id });
  const history = api.requests
    .slice(beforeHistory)
    .find((request) => request.path.includes("/movements/"));
  const facets = new URL(history?.path ?? "", "https://test.invalid").searchParams;
  expect(facets.get("lot_code")).toBe("LOT-01");
  expect(facets.get("lot")).toBe(inventoryLot().id);
  expect(
    api.requests
      .slice(beforeHistory)
      .filter((request) => request.path.startsWith("/api/v1/lots/"))
      .map((request) => request.path),
  ).toEqual([]);
  expect(screen.queryByRole("textbox", { name: "Código" })).not.toBeNull();
  const beforeReturn = api.requests.length;
  await user.click(screen.getByRole("link", { name: "LOT-01" }));
  await screen.findByText("Consulta de custodia · sólo lectura");
  expect(
    api.requests
      .slice(beforeReturn)
      .filter((request) => request.path.startsWith(`/api/v1/locations/${site}/`))
      .map((request) => request.path),
  ).toEqual([]);
  await act(async () => {
    await app.router.navigate({
      to: "/inventory/locations/$code",
      params: { code: "LOC-B" },
      search: { view: "movements", custody_location: site },
    });
  });
  await screen.findByRole("link", { name: inventoryMovement().operation_id });
  await user.click(screen.getByRole("tab", { name: "Existencias" }));
  await waitFor(() => {
    expect(api.requests.some((request) => request.path.includes(`/locations/${site}/stock/`))).toBe(
      true,
    );
  });
  expect(app.router.state.location.search).toHaveProperty("custody_location", site);
});

test("URL expiry/blocker/order/page reach the server and remain on record/back links", async () => {
  const user = userEvent.setup();
  const { api } = await openInventory({
    path: "/inventory/lots?status=blocked&blocked_by=lot_expired&expiry_from_date=2026-11-01&expiry_before_date=2026-12-01&ordering=-expiry&page=2&unsupported=ignored",
    routes: {
      "GET /api/v1/lots/": () =>
        Response.json(
          inventoryPage([inventoryLot({ admission_id: INVENTORY_ADMISSION, quantity: "100" })]),
        ),
    },
  });
  const code = await screen.findByRole("link", { name: "LOT-01" });
  expect(screen.getByRole("columnheader", { name: /Cantidad inicial/ })).toBeDefined();
  expect(screen.queryByRole("columnheader", { name: /Cantidad inicial de admisión/ })).toBeNull();
  const admissionLink = new URL(
    screen.getByRole("link", { name: "100" }).getAttribute("href") ?? "",
    "https://test.invalid",
  );
  expect(admissionLink.pathname).toBe("/inventory/locations/LOC-01");
  expect(admissionLink.searchParams.get("lot")).toBe(inventoryLot().id);
  const request = api.requests.find((entry) => entry.path.startsWith("/api/v1/lots/?"));
  const params = new URL(request?.path ?? "", "https://test.invalid").searchParams;
  expect(Object.fromEntries(params)).toMatchObject({
    status: "blocked",
    blocked_by: "lot_expired",
    expiry_from_date: "2026-11-01",
    expiry_before_date: "2026-12-01",
    ordering: "-expiry",
    page: "2",
    page_size: "25",
  });
  expect(params.has("unsupported")).toBe(false);
  await user.click(code);
  const back = await screen.findByRole("link", { name: "Volver a la lista" });
  const retained = new URL(back.getAttribute("href") ?? "", "https://test.invalid").searchParams;
  expect(retained.get("blocked_by")).toBe("lot_expired");
  expect(retained.get("page")).toBe("2");
});
test("large signed ledger quantities preserve every fractional digit", () => {
  expect(formatInventoryQuantity("-9007199254740993.000001", "en")).toBe(
    "-9,007,199,254,740,993.000001",
  );
});

test("custody safety requires the returned site and never inherits the nested supply protocol", async () => {
  const site = "cd000000-0000-0000-0000-000000000006";
  let mismatch = false;
  const user = userEvent.setup();
  const { api } = await openInventory({
    path: `/inventory/lots/LOT-01?custody_location=${site}`,
    routes: {
      "GET /api/v1/lots/": () =>
        Response.json(
          inventoryPage([
            inventoryLot({
              protocol_id: null,
              safety_location_id: mismatch ? inventoryLocation().id : site,
            }),
          ]),
        ),
      [`GET /api/v1/lots/${inventoryLot().id}/`]: () =>
        Response.json(inventoryLot({ protocol_id: null, safety_location_id: site })),
    },
  });
  await screen.findByText("Consulta de custodia · sólo lectura");
  expect(screen.queryByText("Synthetic protocol")).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
  mismatch = true;
  await user.click(screen.getByRole("button", { name: "Actualizar estado" }));
  await screen.findByRole("heading", { name: "Custodia no disponible" });
  expect(screen.queryByText("Consulta de custodia · sólo lectura")).toBeNull();
  expect(
    api.requests
      .filter((request) => request.path.startsWith("/api/v1/lots/"))
      .every(
        (request) =>
          new URL(request.path, "https://test.invalid").searchParams.get("custody_location") ===
          site,
      ),
  ).toBe(true);
  expect(api.requests.some((request) => request.path.startsWith("/api/v1/supply-types/"))).toBe(
    false,
  );
});
