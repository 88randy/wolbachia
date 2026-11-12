import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { inventoryLot, inventoryPage } from "../../test/inventory-fixtures";
import { inventoryMe, inventoryPermissions, openInventory } from "../../test/inventory-api";

const me = (extra: string[] = []) =>
  inventoryMe({ permissions: [...inventoryPermissions, ...extra] });

const MOTORCYCLE = {
  id: "00000000-0000-4000-8000-0000000000aa",
  code: "MOTO-03",
  plate: "ABC-123",
  center: "00000000-0000-4000-8000-000000000001",
  voided_at: null,
};

beforeEach(() => {
  window.localStorage.clear();
});

test("one tool for every kind the user can read; no old sizes", async () => {
  await openInventory({
    path: "/inventory/labels",
    me: me(["motorcycle.read", "ovitrap.read"]),
  });
  const tabs = await screen.findAllByRole("tab");
  expect(tabs.map((tab) => tab.textContent)).toEqual([
    "Lotes",
    "Ovitrampas",
    "Motos",
    "Ubicaciones",
  ]);
  expect(screen.queryByText(/Mediana 50/)).toBeNull();
});

test("choosing a kind reads that kind from the API", async () => {
  const user = userEvent.setup();
  const { api } = await openInventory({
    path: "/inventory/labels",
    me: me(["motorcycle.read"]),
    routes: { "GET /api/v1/motorcycles/": () => Response.json(inventoryPage([MOTORCYCLE])) },
  });
  await screen.findByText("LOT-01");
  await user.click(screen.getByRole("tab", { name: "Motos" }));
  await screen.findByText("MOTO-03");
  expect(screen.getByText("Placas ABC-123")).toBeDefined();
  expect(api.requests.some((request) => request.path.startsWith("/api/v1/motorcycles/"))).toBe(
    true,
  );
});

test("ticked records open the print dialog with format and copies", async () => {
  const user = userEvent.setup();
  await openInventory({
    path: "/inventory/labels",
    routes: { "GET /api/v1/lots/": () => Response.json(inventoryPage([inventoryLot()])) },
  });
  const print = await screen.findByRole("button", { name: "Imprimir etiquetas" });
  expect(print.getAttribute("aria-disabled")).toBe("true");
  await user.click(await screen.findByRole("checkbox", { name: "Marcar LOT-01" }));
  await user.click(screen.getByRole("button", { name: "Imprimir etiquetas" }));
  const dialog = await screen.findByRole("dialog");
  within(dialog).getByRole("combobox", { name: "Tamaño de etiqueta" });
  within(dialog).getByLabelText("Copias de cada etiqueta");
  expect(within(dialog).getAllByTestId("label")).toHaveLength(1);
});

test("a deep link by human code ticks that record", async () => {
  const { api } = await openInventory({
    path: "/inventory/labels?kind=location&code=LOC-01",
  });
  const box = await screen.findByRole("checkbox", { name: "Marcar LOC-01" });
  await screen.findByText("1 marcadas");
  expect(box.getAttribute("aria-checked") ?? box.getAttribute("data-state")).toMatch(
    /true|checked/,
  );
  expect(screen.getByRole("tab", { name: "Ubicaciones", selected: true })).toBeDefined();
  expect(
    api.requests.some((request) => /^\/api\/v1\/locations\/\?.*code=LOC-01/.test(request.path)),
  ).toBe(true);
  expect(window.location.search).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
});

test("a deep link to a kind the user cannot print falls back to the first kind", async () => {
  await openInventory({ path: "/inventory/labels?kind=motorcycle&code=MOTO-03" });
  await screen.findByRole("tab", { name: "Lotes", selected: true });
  expect(screen.queryByRole("tab", { name: "Motos" })).toBeNull();
});
