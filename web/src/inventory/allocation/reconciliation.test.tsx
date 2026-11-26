import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { expect, test } from "vitest";
import { makeMe } from "../../test/fake-api";
import { openInventory } from "../../test/inventory-api";
import { inventoryPage } from "../../test/inventory-fixtures";
import {
  INTENT_ID,
  RECON_ID,
  allocationMe,
  reasonRoutes,
  reconciliation,
} from "./allocation-fixtures";
import "../../test/slow-app-flows";

const ROW = reconciliation([
  {},
  { credited: null, difference: null, used: "0", returned: "0", shrinkage: "0" },
]);
const BALANCED = reconciliation([{ difference: "0", used: "18", returned: "1", shrinkage: "1" }]);

function routes(body = ROW) {
  return {
    ...reasonRoutes(),
    "GET /api/v1/reconciliations/": Response.json(inventoryPage([body])),
    "GET /api/v1/lots/": Response.json(inventoryPage([])),
  };
}

/** Row actions live in the row "⋯" menu; open it and return the menu entries it offers. */
async function openRowMenu(user: ReturnType<typeof userEvent.setup>, row: HTMLElement) {
  await user.click(within(row).getByRole("button", { name: "Más opciones" }));
  return screen.findAllByRole("menuitem");
}

test("a nonzero equation offers justify and open-discrepancy, a pending receipt is not a zero", async () => {
  const user = userEvent.setup();
  await openInventory({
    path: "/inventory/reconciliations",
    me: allocationMe(["inventory.reconcile", "discrepancy.read"]),
    routes: routes(),
  });
  const rows = await screen.findAllByRole("row");
  const difference = rows.find((row) => /\+2/.test(row.textContent));
  expect(difference).toBeDefined();
  const offered = await openRowMenu(user, difference as HTMLElement);
  const justify = offered.find((item) => item.textContent === "Justificar la diferencia");
  expect(justify?.getAttribute("aria-disabled")).not.toBe("true");
  const discrepancy = offered.find((item) => item.textContent === "Abrir diferencia");
  expect(discrepancy?.getAttribute("aria-disabled")).not.toBe("true");
  await user.keyboard("{Escape}");
  const pending = rows.find((row) => /Pendiente de firma/.test(row.textContent));
  expect(pending).toBeDefined();
  const pendingMenu = await openRowMenu(user, pending as HTMLElement);
  expect(pendingMenu.some((item) => item.textContent === "Justificar la diferencia")).toBe(false);
  const blocked = pendingMenu.find((item) => item.textContent === "Justificar (esta línea cuadra)");
  expect(blocked?.getAttribute("aria-disabled")).toBe("true");
  expect(
    screen.getByText(/Si el resultado no es cero, hay una diferencia por justificar/),
  ).toBeDefined();
});

test("a balanced line has no corrective actions", async () => {
  await openInventory({
    path: "/inventory/reconciliations",
    me: allocationMe(["inventory.reconcile"]),
    routes: routes(BALANCED),
  });
  expect(await screen.findByText("Cuadra")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Justificar" })).toBeNull();
});

test("justify prepares then executes with the revision the user saw, and keeps the explicit retry", async () => {
  const user = userEvent.setup();
  const { api } = await openInventory({
    path: "/inventory/reconciliations",
    me: allocationMe(["inventory.reconcile"]),
    routes: {
      ...routes(),
      "POST /api/v1/inventory-intents/": Response.json(
        {
          intent: {
            id: INTENT_ID,
            kind: "reconcile_justify",
            expected_revision: 3,
            input_hash: "h",
            evidence: [],
          },
        },
        { status: 201 },
      ),
      [`POST /api/v1/reconciliations/${RECON_ID}/justify/`]: Response.json(
        { justification: { id: INTENT_ID, frame_id: RECON_ID } },
        { status: 201 },
      ),
    },
  });
  document.cookie = "csrftoken=test-csrf; path=/";
  const rows = await screen.findAllByRole("row");
  const difference = rows.find((row) => /\+2/.test(row.textContent));
  await openRowMenu(user, difference as HTMLElement);
  await user.click(await screen.findByRole("menuitem", { name: "Justificar la diferencia" }));
  await user.selectOptions(await screen.findByRole("combobox", { name: "Motivo" }), "duplicate");
  await user.click(screen.getByRole("button", { name: "Registrar justificación" }));
  expect(await screen.findByText("Justificación registrada.")).toBeDefined();
  const posts = api.requests.filter((request) => request.method === "POST");
  expect(posts[0]?.body).toMatchObject({
    kind: "reconcile_justify",
    expected_revision: 3,
    reason_code: "duplicate",
  });
  expect(posts[1]?.body).toEqual({ intent_id: INTENT_ID });
});

test("without the reconcile action an out-of-scope deep link is denied", async () => {
  await openInventory({
    path: "/inventory/reconciliations",
    me: makeMe({ permissions: ["lot.read"] }),
    routes: routes(),
  });
  expect(
    await screen.findByRole("heading", { level: 1, name: "No tienes acceso a esta sección" }),
  ).toBeDefined();
});

test("a user whose scope grants no center sees the denial and no reconciliation data", async () => {
  const me = allocationMe(["inventory.reconcile"]);
  const { api } = await openInventory({
    path: "/inventory/reconciliations",
    me: {
      ...me,
      scope: { centers: { mode: "none", ids: [] }, quadrants: { mode: "none", ids: [] } },
    },
    routes: routes(),
  });
  expect(await screen.findByText(/Tu alcance no incluye/)).toBeDefined();
  await waitFor(() => {
    expect(api.requests.some((request) => request.path.includes("/reconciliations/"))).toBe(false);
  });
});

test.each(["es-MX", "en"] as const)(
  "reconciliation has no axe violations in %s",
  async (language) => {
    const { app } = await openInventory({
      path: "/inventory/reconciliations",
      me: allocationMe(["inventory.reconcile"]),
      routes: routes(),
      language,
    });
    await screen.findAllByRole("row");
    expect(await axe(app.container)).toHaveNoViolations();
  },
);
