import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { expect, test } from "vitest";
import { makeMe } from "../../test/fake-api";
import { openInventory } from "../../test/inventory-api";
import { inventoryPage } from "../../test/inventory-fixtures";
import { COURIER_ID, allocationMe, reasonRoutes, reconciliation } from "./allocation-fixtures";
import "../../test/slow-app-flows";

const LIST_PATH = "/inventory/assignments";
const PATH = "/inventory/assignments/new?date=2026-11-03";
const PERSON = {
  id: COURIER_ID,
  display_name: "Luis",
  is_courier: true,
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
    "GET /api/v1/lookups/users/": Response.json(inventoryPage([PERSON])),
    "GET /api/v1/courier-assignments/suggestion/": Response.json(SUGGESTION_OFF),
    "GET /api/v1/courier-assignments/": Response.json(inventoryPage([frame.assignment])),
    "GET /api/v1/reconciliations/": Response.json(inventoryPage([frame])),
    "GET /api/v1/lots/": Response.json(inventoryPage([])),
  };
}

type OpenOptions = Parameters<typeof openInventory>[0];
const COURIER_TEXT = {
  "es-MX": { picker: "Repartidor", panel: /Entrega para Luis/ },
  en: { picker: "Courier", panel: /Delivery for Luis/ },
} as const;

/** The delivery screen starts with no courier: the chosen one travels in the history state. */
async function openDelivery(options: Omit<OpenOptions, "path">) {
  const text = COURIER_TEXT[options.language ?? "es-MX"];
  const opened = await openInventory({ ...options, path: PATH });
  await userEvent.selectOptions(await screen.findByRole("combobox", { name: text.picker }), "Luis");
  await screen.findByText(text.panel);
  return opened;
}

test("a missing schedule shows no suggestion and no invented quantities", async () => {
  await openDelivery({
    me: allocationMe(["inventory.allocate"]),
    routes: { ...routes(), "GET /api/v1/courier-assignments/": Response.json(inventoryPage([])) },
  });
  expect(await screen.findByText(/todavía no hay programación para ese día/)).toBeDefined();
  expect(screen.queryByText("Sugerido")).toBeNull();
});

test("signature status reports the real pending state of a saved assignment", async () => {
  await openDelivery({
    me: allocationMe(["inventory.allocate", "inventory.reconcile"]),
    routes: routes(),
  });
  expect(await screen.findByText("Esperando firma en el teléfono")).toBeDefined();
});

test("a signed receipt is reported as verified", async () => {
  await openDelivery({
    me: allocationMe(["inventory.allocate", "inventory.reconcile"]),
    routes: routes(reconciliation([{ difference: "0" }])),
  });
  expect(await screen.findByText("Recibido y firmado")).toBeDefined();
});

test("without reconcile access the signature state is unknown, not invented", async () => {
  await openDelivery({ me: allocationMe(["inventory.allocate"]), routes: routes() });
  expect(await screen.findByText("Estado de firma no disponible")).toBeDefined();
});

test("an out-of-scope deep link to assignments is denied", async () => {
  await openInventory({
    path: LIST_PATH,
    me: makeMe({ permissions: ["lot.read"] }),
    routes: routes(),
  });
  expect(
    await screen.findByRole("heading", { level: 1, name: "No tienes acceso a esta sección" }),
  ).toBeDefined();
});

test.each(["es-MX", "en"] as const)("assignment has no axe violations in %s", async (language) => {
  const { app } = await openDelivery({
    me: allocationMe(["inventory.allocate", "inventory.reconcile"]),
    routes: routes(),
    language,
  });
  expect(await axe(app.container)).toHaveNoViolations();
});

test("the chosen courier rides in the history state and never as an id in the URL", async () => {
  const { app } = await openInventory({
    path: "/inventory/assignments/new?date=2026-11-03",
    me: allocationMe(["inventory.allocate"]),
    routes: routes(),
  });
  await userEvent.selectOptions(
    await screen.findByRole("combobox", { name: "Repartidor" }),
    "Luis",
  );
  expect(await screen.findByText(/Entrega para Luis/)).toBeDefined();
  expect(app.router.state.location.href).not.toContain(COURIER_ID);
  expect(app.router.state.location.state.courier).toBe(COURIER_ID);
});
