import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vitest";
import userEvent from "@testing-library/user-event";
import { inventorySupply, inventoryProtocol, inventoryPage } from "../../test/inventory-fixtures";
import { inventoryMe, openInventory } from "../../test/inventory-api";
import { apiError } from "../../test/fake-api";
function fillField(name: string, value: string) {
  fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
}
test("retirement confirms the opened revision and requires a new explicit confirmation after conflict", async () => {
  const user = userEvent.setup();
  let current = inventorySupply({ revision: 2 });
  let writes = 0;
  const { api, app } = await openInventory({
    path: "/inventory/supplies/SUP-01",
    routes: {
      "GET /api/v1/supply-types/": () => Response.json(inventoryPage([current])),
      [`POST /api/v1/supply-types/${current.id}/deactivate/`]: () => {
        if (++writes === 1) return apiError(409, "inventory_state_conflict");
        current = { ...current, revision: 4, is_active: false };
        return Response.json(current);
      },
    },
  });
  const retire = await screen.findByRole("button", { name: "Desactivar insumo" });
  await user.click(retire);
  current = { ...current, revision: 3, label: "Later current supply" };
  await act(async () => {
    await app.queryClient.refetchQueries({
      predicate: (query) => query.queryKey[3] === "inventory",
    });
  });
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Desactivar insumo" }),
  );
  const review = await screen.findByRole("button", {
    name: "Revisar versión actual y conservar captura",
  });
  await waitFor(() => {
    expect(review.hasAttribute("disabled")).toBe(false);
  });
  expect(writes).toBe(1);
  await user.click(review);
  await user.click(retire);
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Desactivar insumo" }),
  );
  expect((await screen.findAllByText("Desactivado")).length).toBeGreaterThan(0);
  expect(retire.hasAttribute("disabled")).toBe(true);
  expect(
    api.requests.filter((request) => request.method === "POST").map((request) => request.body),
  ).toEqual([{ expected_revision: 2 }, { expected_revision: 3 }]);
});

test("W8 presents the real scoped supply and hides configuration writes without their action", async () => {
  await openInventory({
    path: "/inventory/supplies",
    me: inventoryMe({ permissions: ["supply_type.read"] }),
  });
  expect(await screen.findByRole("heading", { name: "Catálogo de insumos" })).toBeDefined();
  expect(await screen.findByRole("link", { name: "SUP-01" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Nuevo insumo" })).toBeNull();
});

test("a conflict refresh with unreadable protocol blocks rewriting it and permits explicit protocol-only discard", async () => {
  const user = userEvent.setup();
  let current = inventorySupply({ revision: 2 });
  let writes = 0;
  const unreadable = {
    ...inventoryProtocol(),
    name: "Current unreadable protocol",
    reading_windows: { future: true },
    required_fields: "future",
  };
  const { api } = await openInventory({
    path: "/inventory/supplies/SUP-01",
    routes: {
      "GET /api/v1/supply-types/": () => Response.json(inventoryPage([current])),
      [`PATCH /api/v1/supply-types/${current.id}/`]: () => {
        if (++writes === 1) {
          current = { ...current, revision: 3, protocol: unreadable };
          return apiError(409, "inventory_state_conflict");
        }
        current = { ...current, revision: 4, label: "Retained identity change" };
        return Response.json(current);
      },
    },
  });
  await screen.findByRole("textbox", { name: "Nombre del insumo" });
  fillField("Nombre del insumo", "Retained identity change");
  fillField("Nombre del protocolo", "Retained protocol edit");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  const review = await screen.findByRole("button", {
    name: "Revisar versión actual y conservar captura",
  });
  await waitFor(() => {
    expect(review.hasAttribute("disabled")).toBe(false);
  });
  await user.click(review);
  await screen.findByRole("button", { name: "Descartar sólo los cambios de protocolo" });
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText("Revisa el formato o los valores.");
  expect(writes).toBe(1);
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "Nombre del protocolo" }).value,
  ).toBe("Retained protocol edit");
  await user.click(screen.getByRole("button", { name: "Descartar sólo los cambios de protocolo" }));
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Nombre del insumo" }).value).toBe(
    "Retained identity change",
  );
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText("Guardado");
  const requests = api.requests.filter((request) => request.method === "PATCH");
  expect(requests).toHaveLength(2);
  expect(requests[1]?.body).toMatchObject({
    expected_revision: 3,
    label: "Retained identity change",
  });
  expect(requests[1]?.body).not.toHaveProperty("protocol");
});
test("W8 saves named configuration without inventing biological or nullable safety defaults", async () => {
  const user = userEvent.setup();
  let committed = false;
  const saved = inventorySupply({
    id: "00000000-0000-4000-8000-000000000016",
    code: "SUP-NEW",
    label: "Authored supply",
    unit: "container",
    identity_kind: "lot",
    is_biological: false,
    is_chemical: null,
    expiry_required: null,
    requires_insecticide_free: null,
    protocol: {
      ...inventoryProtocol(),
      name: "Authored protocol",
      shelf_life_seconds: null,
      expiry_basis: "",
      temperature_min: "0.000000",
      temperature_max: null,
      humidity_min: null,
      humidity_max: null,
      reading_windows: [],
      required_fields: [],
    },
  });
  const { api } = await openInventory({
    path: "/inventory/supplies",
    routes: {
      "POST /api/v1/supply-types/": () => {
        committed = true;
        throw new TypeError("Synthetic lost catalog response");
      },
      "GET /api/v1/supply-types/": (request) =>
        Response.json(
          inventoryPage(
            request.path.includes("code=SUP-NEW") && committed
              ? [saved]
              : committed
                ? [inventorySupply(), saved]
                : [inventorySupply()],
          ),
        ),
    },
  });
  await user.click(await screen.findByRole("button", { name: "Nuevo insumo" }));
  fillField("Código", "SUP-NEW");
  fillField("Nombre del insumo", "Authored supply");
  fillField("Unidad declarada", "container");
  await user.selectOptions(screen.getByRole("combobox", { name: "Identificación" }), "lot");
  await user.selectOptions(screen.getByRole("combobox", { name: "Biológico" }), "false");
  fillField("Nombre del protocolo", "Authored protocol");
  fillField("Temperatura mínima (°C)", "-0.0");
  await user.click(screen.getByRole("button", { name: "Crear registro" }));
  const reconcile = await screen.findByRole("button", { name: "Consultar el registro guardado" });
  await waitFor(() => {
    expect(reconcile.hasAttribute("disabled")).toBe(false);
  });
  await user.click(reconcile);
  await screen.findByText("Guardado");
  expect(api.requests.find((request) => request.method === "POST")?.body).toMatchObject({
    code: "SUP-NEW",
    unit: "container",
    is_biological: false,
    expiry_required: null,
    requires_insecticide_free: null,
    protocol: {
      name: "Authored protocol",
      shelf_life_seconds: null,
      reading_windows: [],
      temperature_min: "-0.0",
    },
  });
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  await screen.findByRole("link", { name: "SUP-NEW" });
});

test("modal Cancel preserves the private supply draft without submitting", async () => {
  const user = userEvent.setup();
  const { api } = await openInventory({ path: "/inventory/supplies" });
  await user.click(await screen.findByRole("button", { name: "Nuevo insumo" }));
  const dialog = screen.getByRole("dialog");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Nombre del insumo" }),
    "Retained modal input",
  );
  await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Nuevo insumo" }));
  expect(
    within(screen.getByRole("dialog")).getByRole<HTMLInputElement>("textbox", {
      name: "Nombre del insumo",
    }).value,
  ).toBe("Retained modal input");
  expect(api.requests.filter((r) => r.method === "POST")).toHaveLength(0);
});
