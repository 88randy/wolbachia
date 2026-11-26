import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { inventoryLot, inventoryPage } from "../../test/inventory-fixtures";
import { inventoryMe, inventoryPermissions, openInventory } from "../../test/inventory-api";
import "../../test/slow-app-flows";

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

test("marking records updates the live preview, with format and copies and no dialog", async () => {
  const user = userEvent.setup();
  await openInventory({
    path: "/inventory/labels",
    routes: { "GET /api/v1/lots/": () => Response.json(inventoryPage([inventoryLot()])) },
  });
  const print = await screen.findByRole("button", { name: "Imprimir" });
  expect(print.getAttribute("aria-disabled")).toBe("true");
  expect(screen.queryAllByTestId("label")).toHaveLength(0);
  screen.getByRole("combobox", { name: "Tamaño de etiqueta" });
  screen.getByLabelText("Copias de cada etiqueta");
  await user.click(await screen.findByRole("checkbox", { name: "Marcar LOT-01" }));
  expect(await screen.findAllByTestId("label")).toHaveLength(2);
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByRole("checkbox", { name: "Marcar LOT-01" }));
  expect(screen.queryAllByTestId("label")).toHaveLength(0);
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

const NEW_UUID = "11111111-2222-4333-8444-555555555555";
const FREE_UUID = "66666666-7777-4888-8999-000000000000";
const COUNT_FIELD = "Cuántas etiquetas (1 a 200)";

function ovitrapRoutes(sent?: { count: number }) {
  return {
    "GET /api/v1/ovitraps/": () => Response.json(inventoryPage([])),
    "GET /api/v1/ovitrap-labels/unplaced/": () =>
      Response.json({
        labels: [{ id: FREE_UUID, code: "OVT-0007", created_at: "2026-11-17T10:00:00Z" }],
      }),
    "POST /api/v1/ovitrap-labels/": (request: { body: unknown }) => {
      if (sent) sent.count = (request.body as { count: number }).count;
      return Response.json(
        { labels: [{ id: NEW_UUID, code: "OVT-0008", created_at: "2026-11-17T10:05:00Z" }] },
        { status: 201 },
      );
    },
  };
}

test("generating new ovitrap labels registers them and leaves them ready to print", async () => {
  const user = userEvent.setup();
  const sent = { count: 0 };
  await openInventory({
    path: "/inventory/labels?kind=ovitrap",
    me: me(["ovitrap.read"]),
    routes: ovitrapRoutes(sent),
  });
  await screen.findByText("OVT-0007");
  expect(screen.getByText("Sin colocar")).toBeDefined();
  await user.clear(screen.getByLabelText(COUNT_FIELD));
  await user.type(screen.getByLabelText(COUNT_FIELD), "1");
  await user.click(screen.getByRole("button", { name: "Generar etiquetas nuevas" }));
  await screen.findByText(/Se generaron 1 etiquetas/);
  expect(sent.count).toBe(1);
  expect(await screen.findAllByTestId("label")).toHaveLength(2);
  expect(screen.getAllByText("OVT-0008").length).toBeGreaterThan(0);
  expect(document.body.textContent).not.toContain(NEW_UUID);
});

test("the generate button refuses a count outside 1 to 200 and says why", async () => {
  const user = userEvent.setup();
  await openInventory({
    path: "/inventory/labels?kind=ovitrap",
    me: me(["ovitrap.read"]),
    routes: ovitrapRoutes(),
  });
  const field = await screen.findByLabelText(COUNT_FIELD);
  await user.clear(field);
  await user.type(field, "201");
  const button = screen.getByRole("button", { name: "Generar etiquetas nuevas" });
  expect(button.getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByText("Escribe un número entero de 1 a 200.")).toBeDefined();
});

test("without the inventory write permission there is no generate button and no pool read", async () => {
  const { api } = await openInventory({
    path: "/inventory/labels?kind=ovitrap",
    me: inventoryMe({ permissions: ["lot.read", "ovitrap.read"] }),
    routes: ovitrapRoutes(),
  });
  await screen.findByRole("tab", { name: "Ovitrampas", selected: true });
  expect(screen.queryByRole("button", { name: "Generar etiquetas nuevas" })).toBeNull();
  expect(api.requests.some((request) => request.path.includes("ovitrap-labels"))).toBe(false);
});

test("whoever registers stickers can print them without reading placed ovitraps", async () => {
  const { api } = await openInventory({
    path: "/inventory/labels?kind=ovitrap",
    me: me(),
    routes: ovitrapRoutes(),
  });
  await screen.findByText("OVT-0007");
  expect(screen.getByRole("tab", { name: "Ovitrampas", selected: true })).toBeDefined();
  expect(api.requests.some((request) => request.path.startsWith("/api/v1/ovitraps/"))).toBe(false);
});

test("a deep link to a kind the user cannot print falls back to the first kind", async () => {
  await openInventory({ path: "/inventory/labels?kind=motorcycle&code=MOTO-03" });
  await screen.findByRole("tab", { name: "Lotes", selected: true });
  expect(screen.queryByRole("tab", { name: "Motos" })).toBeNull();
});
