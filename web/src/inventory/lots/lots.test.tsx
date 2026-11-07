import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { openInventory } from "../../test/inventory-api";
import {
  inventoryLot,
  inventoryPage,
  inventorySupply,
  inventoryProtocol,
} from "../../test/inventory-fixtures";
import { apiError } from "../../test/fake-api";
afterEach(() => {
  vi.useRealTimers();
});

test("an incomplete biological draft shows real dispatch requirements and preserves its null protocol on completion", async () => {
  const user = userEvent.setup();
  let lot = inventoryLot({
    protocol_id: null,
    blocked_by: [{ reason: "protocol_not_configured", unblocked_by_role: "warehouse", link: "" }],
  });
  const { api } = await openInventory({
    path: "/inventory/lots/LOT-01",
    routes: {
      "GET /api/v1/lots/": () => Response.json(inventoryPage([lot])),
      [`PATCH /api/v1/lots/${lot.id}/`]: () => {
        lot = {
          ...lot,
          revision: 3,
          species: "Authored species",
          missing_fields: [],
          status: "blocked",
        };
        return Response.json(lot);
      },
    },
  });
  await user.click(await screen.findByRole("button", { name: "Ver requisitos de despacho" }));
  expect(screen.getByText(/Protocolo sin configurar/)).toBeDefined();
  await user.type(screen.getByRole("textbox", { name: "Especie" }), "Authored species");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByText("Guardado en el servidor");
  expect(screen.getByText("Bloqueado")).toBeDefined();
  const body = api.requests.find((request) => request.method === "PATCH")?.body;
  expect(body).toMatchObject({ expected_revision: 2, species: "Authored species" });
  expect(body).not.toHaveProperty("protocol_id");
  expect(body).not.toHaveProperty("quadrant_id");
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
});

test.each([true, false])(
  "explicit adoption pins the displayed supply version and its actual protocol (%s)",
  async (configured) => {
    const user = userEvent.setup();
    const lot = inventoryLot();
    let current = lot;
    const supply = inventorySupply({
      version: "00000000-0000-4000-8000-000000000013",
      revision: 2,
      protocol: configured
        ? { ...inventoryProtocol(), id: "00000000-0000-4000-8000-000000000014" }
        : null,
    });
    const newest = inventorySupply({
      version: "00000000-0000-4000-8000-000000000019",
      revision: 3,
      label: "Unreviewed supply",
      protocol: {
        ...inventoryProtocol(),
        id: "00000000-0000-4000-8000-000000000020",
        name: "Unreviewed protocol",
      },
    });
    let release: (response: Response) => void = () => undefined;
    const refreshed = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let waiting = false;
    const { api, app } = await openInventory({
      path: "/inventory/lots/LOT-01",
      routes: {
        "GET /api/v1/lots/": () => Response.json(inventoryPage([current])),
        [`GET /api/v1/supply-types/${lot.supply}/`]: () => Response.json(supply),
        [`PATCH /api/v1/lots/${lot.id}/`]: () => {
          current = {
            ...lot,
            revision: 3,
            supply_version_id: supply.version,
            supply_version: supply,
            protocol_id: supply.protocol?.id ?? null,
          };
          throw new TypeError("Synthetic lost adoption response");
        },
      },
    });
    const adopt = await screen.findByRole("button", {
      name: "Adoptar configuración actual del insumo",
    });
    await waitFor(() => {
      expect(adopt.hasAttribute("disabled")).toBe(false);
    });
    await user.click(adopt);
    expect(api.requests.some((request) => request.method === "PATCH")).toBe(false);
    api.setRoute(`GET /api/v1/supply-types/${lot.supply}/`, () => {
      waiting = true;
      return refreshed;
    });
    let refresh: Promise<void> = Promise.resolve();
    act(() => {
      refresh = app.queryClient.refetchQueries({
        predicate: (query) => query.queryKey[4] === "current-supply",
      });
    });
    await waitFor(() => {
      expect(waiting).toBe(true);
    });
    await act(async () => {
      release(Response.json(newest));
      await refresh;
    });
    expect(screen.getByRole("dialog").textContent).toContain("Synthetic supply");
    expect(screen.getByRole("dialog").textContent).not.toContain("Unreviewed");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Adoptar configuración actual del insumo",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => {
      expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1);
    });
    expect(api.requests.find((request) => request.method === "PATCH")?.body).toMatchObject({
      supply_version_id: supply.version,
      protocol_id: supply.protocol?.id ?? null,
    });
    await user.click(await screen.findByRole("button", { name: "Consultar el registro guardado" }));
    await screen.findByText("Guardado en el servidor");
    expect(api.requests.find((request) => request.method === "PATCH")?.body).toMatchObject({
      expected_revision: 2,
      supply_version_id: supply.version,
      protocol_id: supply.protocol?.id ?? null,
    });
  },
);

test("editing cannot bypass Retry-After and expiry never replays the lot write", async () => {
  const user = userEvent.setup();
  let release: (response: Response) => void = () => undefined;
  const reply = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const lot = inventoryLot();
  const { api } = await openInventory({
    path: "/inventory/lots/LOT-01",
    routes: { [`PATCH /api/v1/lots/${lot.id}/`]: () => reply },
  });
  const observations = await screen.findByRole("textbox", { name: "Observaciones" });
  await user.type(observations, "Retained during cooldown");
  const submit = screen.getByRole("button", { name: "Guardar cambios" });
  await user.click(submit);
  await waitFor(() => {
    expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1);
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
  await act(async () => {
    release(apiError(429, "throttled", { headers: { "Retry-After": "5" } }));
    await reply;
  });
  fireEvent.change(observations, { target: { value: "Still retained" } });
  expect(submit.getAttribute("aria-disabled")).toBe("true");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4999);
  });
  expect(submit.getAttribute("aria-disabled")).toBe("true");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(submit.getAttribute("aria-disabled")).toBe("false");
  expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1);
});

test("a lost lot write confirms an exact decimal representation only after the matching read", async () => {
  const user = userEvent.setup();
  let current = inventoryLot();
  const { api } = await openInventory({
    path: "/inventory/lots/LOT-01",
    routes: {
      "GET /api/v1/lots/": () => Response.json(inventoryPage([current])),
      [`PATCH /api/v1/lots/${current.id}/`]: () => {
        current = { ...current, revision: 3, quantity: "1.600000" };
        return apiError(502, "unknown_error");
      },
    },
  });
  const quantity = await screen.findByRole("textbox", { name: "Cantidad inicial" });
  await user.clear(quantity);
  await user.type(quantity, "001.50");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  const reconcile = await screen.findByRole("button", { name: "Consultar el registro guardado" });
  await user.click(reconcile);
  await waitFor(() => {
    expect(
      api.requests.filter((request) => request.path.startsWith("/api/v1/lots/?")).length,
    ).toBeGreaterThan(1);
  });
  expect(
    screen.getByRole("button", { name: "Guardar cambios" }).getAttribute("aria-disabled"),
  ).toBe("true");
  current = { ...current, quantity: "1.500000" };
  await user.click(reconcile);
  await screen.findByText("Guardado en el servidor");
  const writes = api.requests.filter((request) => request.method === "PATCH");
  expect(writes).toHaveLength(1);
  expect(writes[0]?.body).toMatchObject({ quantity: "001.50", expected_revision: 2 });
});

test("lost PATCH reconciliation ignores a later change to an unsent lot field", async () => {
  const user = userEvent.setup();
  let current = inventoryLot({ provenance: "Original provenance" });
  const { api } = await openInventory({
    path: "/inventory/lots/LOT-01",
    routes: {
      "GET /api/v1/lots/": () => Response.json(inventoryPage([current])),
      [`PATCH /api/v1/lots/${current.id}/`]: () => {
        current = {
          ...current,
          revision: 4,
          observations: "Committed observations",
          provenance: "Later concurrent provenance",
        };
        throw new TypeError("Synthetic lost response");
      },
    },
  });
  fireEvent.change(await screen.findByRole("textbox", { name: "Observaciones" }), {
    target: { value: "Committed observations" },
  });
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  const reconcile = await screen.findByRole("button", { name: "Consultar el registro guardado" });
  await waitFor(() => {
    expect(reconcile.hasAttribute("disabled")).toBe(false);
  });
  await user.click(reconcile);
  await screen.findByText("Guardado en el servidor");
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Procedencia" }).value).toBe(
    "Later concurrent provenance",
  );
  const writes = api.requests.filter((request) => request.method === "PATCH");
  expect(writes).toHaveLength(1);
  expect(writes[0]?.body).not.toHaveProperty("provenance");
  expect(writes[0]?.body).toMatchObject({
    expected_revision: 2,
    observations: "Committed observations",
  });
});

test("409 retains draft and reviewed revision until an explicit review and manual resubmit", async () => {
  const user = userEvent.setup();
  let lot = inventoryLot();
  let attempts = 0;
  const { api } = await openInventory({
    path: "/inventory/lots/LOT-01",
    routes: {
      "GET /api/v1/lots/": () => Response.json(inventoryPage([lot])),
      [`PATCH /api/v1/lots/${lot.id}/`]: () => {
        if (++attempts === 1) {
          lot = { ...lot, revision: 3, observations: "Concurrent server note" };
          return Response.json(
            {
              code: "inventory_state_conflict",
              blocked_by: [
                {
                  reason: "inventory_revision_conflict",
                  current_revision: 3,
                  unblocked_by_role: "warehouse",
                  link: "",
                },
              ],
            },
            { status: 409 },
          );
        }
        return Response.json({ ...lot, revision: 4, observations: "Keep this draft" });
      },
    },
  });
  await user.type(await screen.findByRole("textbox", { name: "Observaciones" }), "Keep this draft");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await screen.findByRole("button", { name: "Revisar versión actual y conservar captura" });
  await screen.findByText("Concurrent server note");
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Observaciones" }).value).toBe(
    "Keep this draft",
  );
  expect(attempts).toBe(1);
  await user.click(
    screen.getByRole("button", { name: "Revisar versión actual y conservar captura" }),
  );
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => {
    expect(attempts).toBe(2);
  });
  expect(
    api.requests.filter((request) => request.method === "PATCH").map((request) => request.body),
  ).toMatchObject([
    { expected_revision: 2, observations: "Keep this draft" },
    { expected_revision: 3, observations: "Keep this draft" },
  ]);
});
