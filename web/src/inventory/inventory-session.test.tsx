import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { apiError } from "../test/fake-api";
import { fakePassword } from "../test/fake-credentials";
import { inventoryMe, openInventory } from "../test/inventory-api";
import {
  inventoryLot,
  inventoryPage,
  inventoryLocation,
  INVENTORY_CENTER,
  INVENTORY_OWNER,
} from "../test/inventory-fixtures";
function deferred() {
  let release: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { release, promise };
}
const selected = () =>
  inventoryMe({
    scope: {
      centers: { mode: "selected", ids: [INVENTORY_CENTER] },
      quadrants: { mode: "all", ids: [] },
    },
  });

test("an A→B→A scope transition discards the exact earlier pending response", async () => {
  const late = deferred();
  let reads = 0;
  const { api, app } = await openInventory({
    path: "/inventory/lots",
    routes: {
      "GET /api/v1/lots/": () =>
        ++reads === 2
          ? late.promise
          : Response.json(
              inventoryPage([
                inventoryLot({
                  code: reads === 1 ? "OLD-A" : reads === 3 ? "CURRENT-B" : "CURRENT-A",
                }),
              ]),
            ),
    },
  });
  await screen.findByRole("link", { name: "OLD-A" });
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = app.queryClient.refetchQueries({
      predicate: (query) => query.queryKey[3] === "inventory",
    });
  });
  await waitFor(() => {
    expect(reads).toBe(2);
  });
  api.setRoute("GET /api/v1/me/", () => Response.json(selected()));
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await screen.findByRole("link", { name: "CURRENT-B" });
  api.setRoute("GET /api/v1/me/", () => Response.json(inventoryMe()));
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await screen.findByRole("link", { name: "CURRENT-A" });
  await act(async () => {
    late.release(Response.json(inventoryPage([inventoryLot({ code: "OBSOLETE-A" })])));
    await pending;
  });
  expect(screen.queryByText("OBSOLETE-A")).toBeNull();
  expect(screen.queryByText("OLD-A")).toBeNull();
});

test("scope refresh restores a permitted draft only after the current read and destroys it after denial", async () => {
  const user = userEvent.setup();
  const currentRead = deferred();
  let phase = "initial";
  let held = false;
  const { api, app } = await openInventory({
    path: "/inventory/lots/LOT-01",
    routes: {
      "GET /api/v1/lots/": () => {
        if (phase === "permitted") {
          held = true;
          return currentRead.promise;
        }
        return Response.json(inventoryPage(phase === "denied" ? [] : [inventoryLot()]));
      },
    },
  });
  await user.type(
    await screen.findByRole("textbox", { name: "Observaciones" }),
    "Private retained draft",
  );
  phase = "permitted";
  api.setRoute("GET /api/v1/me/", () => Response.json(selected()));
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await waitFor(() => {
    expect(held).toBe(true);
  });
  expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
  act(() => {
    currentRead.release(Response.json(inventoryPage([inventoryLot()])));
  });
  expect(
    (await screen.findByRole<HTMLInputElement>("textbox", { name: "Observaciones" })).value,
  ).toBe("Private retained draft");
  phase = "denied";
  api.setRoute("GET /api/v1/me/", () =>
    Response.json(
      inventoryMe({
        scope: { centers: { mode: "none", ids: [] }, quadrants: { mode: "none", ids: [] } },
      }),
    ),
  );
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await screen.findByRole("heading", { name: "No encontramos esta página" });
  phase = "restored";
  api.setRoute("GET /api/v1/me/", () => Response.json(inventoryMe()));
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  expect(
    (await screen.findByRole<HTMLInputElement>("textbox", { name: "Observaciones" })).value,
  ).toBe("");
});

const creationCases = {
  lotLocation: {
    locationMode: false,
    centerOnly: false,
    path: "/inventory/lots/new",
    choice: "LOC-01",
    selector: "Ubicación inicial",
    value: inventoryLocation().id,
    field: "Observaciones",
  },
  lotCenterOnly: {
    locationMode: false,
    centerOnly: true,
    path: "/inventory/lots/new",
    choice: "Borrador sólo del centro, sin ubicación",
    selector: "Ubicación inicial",
    value: "none",
    field: "Observaciones",
  },
  location: {
    locationMode: true,
    centerOnly: false,
    path: "/inventory/locations",
    choice: "Sólo centro, sin cuadrante",
    selector: "Cuadrante",
    value: "none",
    field: "Nombre",
  },
} as const;
test.each(["lotLocation", "lotCenterOnly", "location"] as const)(
  "new %s draft waits for actual current action target, retires denial and rejects late ABA restoration",
  async (mode) => {
    const user = userEvent.setup();
    const { locationMode, centerOnly, path, choice, selector, value, field } = creationCases[mode];
    const first = deferred();
    const late = deferred();
    let phase = "initial";
    let held = "";
    const location = inventoryLocation();
    const target = {
      kind: centerOnly ? "center_only_draft" : "location",
      location_id: centerOnly ? null : location.id,
      quadrant_id: null,
      code: centerOnly ? null : location.code,
      is_read_only: false,
    };
    const decoy = {
      ...target,
      kind: "location",
      location_id: "00000000-0000-4000-8000-000000000015",
      code: "OTHER",
    };
    const targetPage = () =>
      locationMode
        ? inventoryPage([{ membership_id: INVENTORY_OWNER, label: "Synthetic owner" }])
        : inventoryPage([target]);
    const access = (path: string) => {
      if (phase === "denied")
        return locationMode ? apiError(404, "not_found") : Response.json(inventoryPage([decoy]));
      if (phase === "permitted" || phase === "obsolete") {
        if (!locationMode && new URL(path, "https://test.invalid").searchParams.get("page") !== "2")
          return Response.json({ ...inventoryPage([decoy], 2), next: "?page=2" });
        held = phase;
        return phase === "permitted" ? first.promise : late.promise;
      }
      return Response.json(targetPage());
    };
    const { api, app } = await openInventory({
      path,
      routes: {
        "GET /api/v1/locations/owner-options/": (request) => access(request.path),
        "GET /api/v1/locations/placement-options/": (request) =>
          locationMode
            ? Response.json(inventoryPage([{ kind: "center_only", quadrant_id: null, code: null }]))
            : access(request.path),
      },
    });
    const reopen = async () => {
      if (locationMode)
        await user.click(await screen.findByRole("button", { name: "Nueva ubicación" }));
    };
    await reopen();
    await screen.findByRole("option", { name: "Synthetic center" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Centro" }), INVENTORY_CENTER);
    await screen.findByRole("option", { name: choice });
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: selector,
      }),
      value,
    );
    fireEvent.change(screen.getByRole("textbox", { name: field }), {
      target: { value: "Private unsaved target" },
    });
    const refresh = async (nextPhase: string, me: ReturnType<typeof inventoryMe>) => {
      phase = nextPhase;
      api.setRoute("GET /api/v1/me/", () => Response.json(me));
      await act(async () => {
        await app.queryClient.refetchQueries({ queryKey: ["me"] });
      });
      await reopen();
    };
    await refresh("permitted", selected());
    await waitFor(() => {
      expect(held).toBe("permitted");
    });
    expect(screen.queryByDisplayValue("Private unsaved target")).toBeNull();
    act(() => {
      first.release(Response.json(targetPage()));
    });
    expect((await screen.findByRole<HTMLInputElement>("textbox", { name: field })).value).toBe(
      "Private unsaved target",
    );
    await refresh("obsolete", inventoryMe());
    await waitFor(() => {
      expect(held).toBe("obsolete");
    });
    expect(screen.queryByDisplayValue("Private unsaved target")).toBeNull();
    await refresh(
      "denied",
      inventoryMe({
        scope: { centers: { mode: "none", ids: [] }, quadrants: { mode: "none", ids: [] } },
      }),
    );
    expect((await screen.findByRole<HTMLInputElement>("textbox", { name: field })).value).toBe("");
    await refresh("restored", inventoryMe());
    act(() => {
      late.release(Response.json(targetPage()));
    });
    expect((await screen.findByRole<HTMLInputElement>("textbox", { name: field })).value).toBe("");
    expect(api.requests.filter((request) => request.method !== "GET")).toHaveLength(0);
    if (!locationMode)
      expect(api.requests.some((request) => request.path.includes("page=2"))).toBe(true);
  },
);

test.each(["unknown", "foreign"])(
  "%s lot codes have the same undisclosed deep-link state",
  async (kind) => {
    await openInventory({
      path: "/inventory/lots/OTHER",
      routes: {
        "GET /api/v1/lots/":
          kind === "foreign" ? apiError(404, "not_found") : Response.json(inventoryPage([])),
      },
    });
    await screen.findByRole("heading", { name: "No encontramos esta página" });
  },
);

test.each(["supplies", "locations"] as const)(
  "revoking %s create in a settled session retires only its new draft before regrant",
  async (kind) => {
    const user = userEvent.setup();
    const permission = kind === "supplies" ? "supply_type.create" : "location.create";
    const title = kind === "supplies" ? "Nuevo insumo" : "Nueva ubicación";
    const field = kind === "supplies" ? "Nombre del insumo" : "Nombre";
    const { api, app } = await openInventory({
      path: "/inventory/" + kind,
      routes:
        kind === "locations"
          ? {
              "GET /api/v1/locations/placement-options/": () =>
                Response.json(
                  inventoryPage([{ kind: "center_only", quadrant_id: null, code: null }]),
                ),
            }
          : {},
    });
    await user.click(await screen.findByRole("button", { name: title }));
    if (kind === "locations") {
      await screen.findByRole("option", { name: "Synthetic center" });
      await user.selectOptions(screen.getByRole("combobox", { name: "Centro" }), INVENTORY_CENTER);
      await screen.findByRole("option", { name: "Sólo centro, sin cuadrante" });
      await user.selectOptions(screen.getByRole("combobox", { name: "Cuadrante" }), "none");
    }
    await user.type(
      screen.getByRole("textbox", { name: field }),
      "Retire this revoked creation draft",
    );
    const original = inventoryMe();
    api.setRoute("GET /api/v1/me/", () =>
      Response.json({
        ...original,
        permissions: original.permissions.filter((code) => code !== permission),
      }),
    );
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: title })).toBeNull();
    });
    expect(screen.queryByDisplayValue("Retire this revoked creation draft")).toBeNull();
    api.setRoute("GET /api/v1/me/", () => Response.json(original));
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await user.click(await screen.findByRole("button", { name: title }));
    expect((await screen.findByRole<HTMLInputElement>("textbox", { name: field })).value).toBe("");
    expect(api.requests.filter((request) => request.method !== "GET")).toHaveLength(0);
  },
);

test("reauthentication retains input but does not replay an expired write", async () => {
  const user = userEvent.setup();
  const lot = inventoryLot();
  const { api, app } = await openInventory({
    path: "/inventory/lots/LOT-01",
    routes: {
      [`PATCH /api/v1/lots/${lot.id}/`]: () => apiError(401, "not_authenticated"),
      "POST /api/v1/auth/login/": () =>
        Response.json({ me: inventoryMe(), server_time: "2026-11-06T12:00:00Z" }),
    },
  });
  document.cookie = "csrftoken=test-csrf; path=/";
  await user.type(
    await screen.findByRole("textbox", { name: "Observaciones" }),
    "Retain after reauthentication",
  );
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await user.type(await screen.findByLabelText("Contraseña"), fakePassword());
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await waitFor(() => {
    expect(screen.queryByLabelText("Contraseña")).toBeNull();
  });
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  expect(
    (await screen.findByRole<HTMLInputElement>("textbox", { name: "Observaciones" })).value,
  ).toBe("Retain after reauthentication");
  expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1);
});
