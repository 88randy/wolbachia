import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { openInventory, inventoryMe } from "../../test/inventory-api";
import { inventoryPage, INVENTORY_LOT } from "../../test/inventory-fixtures";
import { apiError } from "../../test/fake-api";
import { conditionStatus, conditionReading } from "./test-fixtures";
import { reconcileSession } from "../../session/session-reconcile";

const statusPath = `GET /api/v1/lots/${INVENTORY_LOT}/condition-status/`;
const readingsPath = `GET /api/v1/lots/${INVENTORY_LOT}/conditions/`;
const path = "/inventory/lots/LOT-01/conditions";
function routes() {
  return {
    [statusPath]: () => Response.json(conditionStatus()),
    [readingsPath]: () =>
      Response.json(
        inventoryPage([
          conditionReading(),
          conditionReading({
            id: "00000000-0000-4000-8000-000000000034",
            lot_version_id: conditionStatus().lot_version_id,
            range: conditionStatus().protocol,
            temperature_c: "25",
            evaluation: "normal",
          }),
        ]),
      ),
  };
}
describe("W18 biological condition monitoring", () => {
  it("uses authoritative slots and exact retained ranges with the current blocking incident", async () => {
    await openInventory({ path, routes: routes() });
    expect(await screen.findByText(/^08:00–09:00.*Lectura registrada$/)).toBeTruthy();
    expect(screen.getByText(/^16:00–17:00.*Lectura pendiente$/)).toBeTruthy();
    expect(screen.getByText(/Lectura pendiente/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "I-010" }).getAttribute("href")).toBe(
      "/incidents/I-010",
    );
    expect(screen.getByText("Retained protocol")).toBeTruthy();
    expect(screen.queryByText("Synthetic protocol")).toBeNull();
    expect((await screen.findAllByText("18–24")).length).toBeGreaterThan(0);
  });
  it("preserves coded invalid capture input and posts an explicit offset without replay", async () => {
    const user = userEvent.setup();
    const { api } = await openInventory({
      path,
      me: inventoryMe({ permissions: ["lot.read", "condition.create"] }),
      routes: {
        ...routes(),
        [`POST /api/v1/lots/${INVENTORY_LOT}/conditions/`]: () =>
          apiError(400, "validation_error", {
            fields: { device_time: [{ code: "out_of_range" }] },
          }),
      },
    });
    const instant = await screen.findByRole("textbox", { name: "Fecha y hora con zona" });
    fireEvent.change(instant, { target: { value: "2026-11-06T08:15:00-06:00" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Temperatura (°C)" }), {
      target: { value: "23" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Humedad (%)" }), {
      target: { value: "65" },
    });
    await user.click(screen.getByRole("button", { name: "Registrar lectura" }));
    await screen.findByText("Revisa este valor y vuelve a guardar.");
    expect((instant as HTMLInputElement).value).toBe("2026-11-06T08:15:00-06:00");
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
    expect(api.requests.find((request) => request.method === "POST")?.body).toEqual({
      device_time: "2026-11-06T08:15:00-06:00",
      temperature_c: "23",
      humidity_pct: "65",
    });
  });
  it("shows missing configuration explicitly and hides forbidden capture", async () => {
    await openInventory({
      path,
      routes: {
        ...routes(),
        [statusPath]: () =>
          Response.json(
            conditionStatus({ protocol: null, protocol_id: null, is_protocol_configured: false }),
          ),
        [readingsPath]: () =>
          Response.json(
            inventoryPage([conditionReading({ range: null, evaluation: "unassessed" })]),
          ),
      },
    });
    expect(
      await screen.findByText("No hay un protocolo completo configurado para este lote."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Registrar lectura" })).toBeNull();
    expect(
      await screen.findByText(
        "Las lecturas sin límites históricos permanecen en la tabla y se excluyen de la gráfica.",
      ),
    ).toBeTruthy();
  });
  it("keeps unknown and inaccessible lot codes indistinguishable", async () => {
    await openInventory({
      path,
      routes: { "GET /api/v1/lots/": () => Response.json(inventoryPage([])) },
    });
    expect(await screen.findByRole("heading", { name: "No encontramos esta página" })).toBeTruthy();
  });
  it("denies capture-only deep links before requesting any lot", async () => {
    const { api } = await openInventory({
      path,
      me: inventoryMe({ permissions: ["condition.create"] }),
      routes: routes(),
    });
    expect(
      await screen.findByRole("heading", { name: "No tienes acceso a esta sección" }),
    ).toBeTruthy();
    expect(api.requests.some((request) => request.path.startsWith("/api/v1/lots/"))).toBe(false);
  });
  it("hides capture when the exact target denies an otherwise granted create action", async () => {
    await openInventory({
      path,
      me: inventoryMe({ permissions: ["lot.read", "condition.create"] }),
      routes: {
        ...routes(),
        [statusPath]: () => Response.json(conditionStatus({ can_create_condition: false })),
      },
    });
    await screen.findByRole("link", { name: "I-010" });
    expect(screen.queryByRole("textbox", { name: "Fecha y hora con zona" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar lectura" })).toBeNull();
  });
  it("refreshes authoritative capability after a denied capture without replaying the command", async () => {
    const user = userEvent.setup();
    let canCapture = true;
    let writes = 0;
    const { api } = await openInventory({
      path,
      me: inventoryMe({ permissions: ["lot.read", "condition.create"] }),
      routes: {
        ...routes(),
        [statusPath]: () => Response.json(conditionStatus({ can_create_condition: canCapture })),
        [`POST /api/v1/lots/${INVENTORY_LOT}/conditions/`]: () => {
          writes += 1;
          canCapture = false;
          return apiError(403, "permission_denied");
        },
      },
    });
    fireEvent.change(await screen.findByRole("textbox", { name: "Fecha y hora con zona" }), {
      target: { value: "2026-11-06T08:15:00-06:00" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Temperatura (°C)" }), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Humedad (%)" }), {
      target: { value: "65" },
    });
    await user.click(screen.getByRole("button", { name: "Registrar lectura" }));
    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "Fecha y hora con zona" })).toBeNull();
    });
    expect(writes).toBe(1);
    expect(
      api.requests.filter((request) => request.path.includes("condition-status")).length,
    ).toBeGreaterThan(1);
    canCapture = true;
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      (await screen.findByRole<HTMLInputElement>("textbox", { name: "Fecha y hora con zona" }))
        .value,
    ).toBe("");
    expect(writes).toBe(1);
  });
  it.each(["read", "capture"] as const)(
    "retires a draft on definitive %s denial after a transient refresh",
    async (kind) => {
      const user = userEvent.setup();
      const { api } = await openInventory({
        path,
        me: inventoryMe({ permissions: ["lot.read", "condition.create"] }),
        routes: routes(),
      });
      const instant = await screen.findByRole<HTMLInputElement>("textbox", {
        name: "Fecha y hora con zona",
      });
      fireEvent.change(instant, { target: { value: "2026-11-06T08:15:00-06:00" } });
      const refresh = screen.getByRole("button", { name: "Reintentar" });
      api.setRoute(statusPath, () => apiError(503, "server_error"));
      await user.click(refresh);
      await screen.findByRole("alert");
      expect(
        screen.getByRole<HTMLInputElement>("textbox", { name: "Fecha y hora con zona" }).value,
      ).toBe("2026-11-06T08:15:00-06:00");
      api.setRoute(statusPath, () =>
        kind === "read"
          ? apiError(403, "permission_denied")
          : Response.json(conditionStatus({ can_create_condition: false })),
      );
      await user.click(refresh);
      await waitFor(() => {
        expect(screen.queryByRole("textbox", { name: "Fecha y hora con zona" })).toBeNull();
      });
      if (kind === "read") expect(screen.queryByRole("link", { name: "I-010" })).toBeNull();
      api.setRoute(statusPath, () => Response.json(conditionStatus()));
      await user.click(refresh);
      expect(
        (await screen.findByRole<HTMLInputElement>("textbox", { name: "Fecha y hora con zona" }))
          .value,
      ).toBe("");
    },
  );
  it("clears old results and ignores a late response when the active center changes", async () => {
    let release: (value: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { app, api } = await openInventory({ path, routes: routes() });
    await screen.findByRole("link", { name: "I-010" });
    api.setRoute(statusPath, () => pending);
    let refresh: Promise<unknown> = Promise.resolve();
    act(() => {
      refresh = app.queryClient.refetchQueries({
        predicate: (query) => query.queryKey.includes("condition-status"),
      });
    });
    await waitFor(() => {
      expect(
        api.requests.filter((request) => request.path.includes("condition-status")).length,
      ).toBeGreaterThan(1);
    });
    api.setRoute("GET /api/v1/lots/", () => Response.json(inventoryPage([])));
    await act(async () => {
      await app.router.navigate({
        to: "/inventory/lots/$code/conditions",
        params: { code: "LOT-01" },
        search: { center: "00000000-0000-4000-8000-000000000099" },
      });
    });
    await act(async () => {
      release(Response.json(conditionStatus()));
      await refresh;
    });
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "I-010" })).toBeNull();
    });
  });
  it("retains a reauthenticated draft and prevents an old capture from releasing a newer attempt", async () => {
    const user = userEvent.setup();
    let releaseOld!: (value: Response) => void;
    let releaseNew!: (value: Response) => void;
    const old = new Promise<Response>((resolve) => {
      releaseOld = resolve;
    });
    const newer = new Promise<Response>((resolve) => {
      releaseNew = resolve;
    });
    let writes = 0;
    const { app } = await openInventory({
      path,
      me: inventoryMe({ permissions: ["lot.read", "condition.create"] }),
      routes: {
        ...routes(),
        [`POST /api/v1/lots/${INVENTORY_LOT}/conditions/`]: () => (++writes === 1 ? old : newer),
      },
    });
    const instant = await screen.findByRole("textbox", { name: "Fecha y hora con zona" });
    fireEvent.change(instant, { target: { value: "2026-11-06T08:15:00-06:00" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Temperatura (°C)" }), {
      target: { value: "23" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Humedad (%)" }), {
      target: { value: "65" },
    });
    await user.click(screen.getByRole("button", { name: "Registrar lectura" }));
    await waitFor(() => {
      expect(writes).toBe(1);
    });
    await act(async () => {
      await reconcileSession(app.queryClient, app.router.options.context.client);
      await app.router.invalidate();
    });
    const retained = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Fecha y hora con zona",
    });
    expect(retained.value).toBe("2026-11-06T08:15:00-06:00");
    expect(writes).toBe(1);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: "Registrar lectura" }).disabled,
      ).toBe(false);
    });
    await user.click(screen.getByRole("button", { name: "Registrar lectura" }));
    await waitFor(() => {
      expect(writes).toBe(2);
    });
    await act(async () => {
      releaseOld(apiError(400, "validation_error"));
      await old;
    });
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Registrar lectura" }).disabled,
    ).toBe(true);
    await act(async () => {
      releaseNew(Response.json(conditionReading()));
      await newer;
    });
    await screen.findByText("Lectura guardada en el servidor");
  });
});
