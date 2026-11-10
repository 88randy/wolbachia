import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { expect, test } from "vitest";
import { makeMe } from "../../test/fake-api";
import { openInventory } from "../../test/inventory-api";
import { inventoryPage } from "../../test/inventory-fixtures";
import { COURIER_ID, allocationMe, reasonRoutes, reconciliation } from "./allocation-fixtures";

const PATH = `/inventory/assignments?date=2026-11-03&courier=${COURIER_ID}`;
const PERSON = {
  id: COURIER_ID,
  display_name: "Luis",
  center_id: COURIER_ID,
  quadrant_id: null,
  work_email: "",
  work_phone: "",
  is_active: true,
  profiles: [],
  trainings: [],
  devices: [],
};
const SUGGESTION_OFF = {
  status: "unavailable",
  date: "2026-11-03",
  courier_id: COURIER_ID,
  lines: [],
};

function routes(frame = reconciliation([{ credited: null, difference: null }])) {
  return {
    ...reasonRoutes(),
    "GET /api/v1/users/operational/": Response.json(inventoryPage([PERSON])),
    "GET /api/v1/courier-assignments/suggestion/": Response.json(SUGGESTION_OFF),
    "GET /api/v1/courier-assignments/": Response.json(inventoryPage([frame.assignment])),
    "GET /api/v1/reconciliations/": Response.json(inventoryPage([frame])),
    "GET /api/v1/lots/": Response.json(inventoryPage([])),
  };
}

test("a missing schedule shows no suggestion and no invented quantities", async () => {
  await openInventory({
    path: PATH,
    me: allocationMe(["inventory.allocate"]),
    routes: { ...routes(), "GET /api/v1/courier-assignments/": Response.json(inventoryPage([])) },
  });
  expect(await screen.findByText(/No hay programación para esta fecha/)).toBeDefined();
  expect(screen.queryByText("Sugerido")).toBeNull();
});

test("signature status reports the real pending state of a saved assignment", async () => {
  await openInventory({
    path: PATH,
    me: allocationMe(["inventory.allocate", "inventory.reconcile"]),
    routes: routes(),
  });
  expect(await screen.findByText("Esperando firma en el teléfono")).toBeDefined();
  expect(screen.getByRole("button", { name: "Enviar a firma" })).toBeDefined();
});

test("a signed receipt is reported as verified", async () => {
  await openInventory({
    path: PATH,
    me: allocationMe(["inventory.allocate", "inventory.reconcile"]),
    routes: routes(reconciliation([{ difference: "0" }])),
  });
  expect(await screen.findByText("Recibido y firmado")).toBeDefined();
});

test("without reconcile access the signature state is unknown, not invented", async () => {
  await openInventory({ path: PATH, me: allocationMe(["inventory.allocate"]), routes: routes() });
  expect(await screen.findByText("Estado de firma no disponible")).toBeDefined();
});

test("an out-of-scope deep link to assignments is denied", async () => {
  await openInventory({ path: PATH, me: makeMe({ permissions: ["lot.read"] }), routes: routes() });
  expect(
    await screen.findByRole("heading", { level: 1, name: "No tienes acceso a esta sección" }),
  ).toBeDefined();
});

test.each(["es-MX", "en"] as const)("assignment has no axe violations in %s", async (language) => {
  const { app } = await openInventory({
    path: PATH,
    me: allocationMe(["inventory.allocate", "inventory.reconcile"]),
    routes: routes(),
    language,
  });
  await screen.findByRole("heading", { level: 2 });
  expect(await axe(app.container)).toHaveNoViolations();
});
