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
  let refuse: (error: Error) => void = () => undefined;
  const promise = new Promise<Response>((resolve, reject) => {
    release = resolve;
    refuse = reject;
  });
  return { release, refuse, promise };
}
const selected = () =>
  inventoryMe({
    scope: {
      centers: { mode: "selected", ids: [INVENTORY_CENTER] },
      quadrants: { mode: "all", ids: [] },
    },
  });

test("custody reads fence same-center ABA and restore the private admission draft only after its fresh action gate", async () => {
  const b1 = "cd000000-0000-0000-0000-000000000001";
  const b2 = "cd000000-0000-0000-0000-000000000002";
  const obsolete = deferred();
  const current = deferred();
  const action = deferred();
  let visits = 0;
  let restoring = false;
  let denyA = false;
  const user = userEvent.setup();
  const { api, app } = await openInventory({
    path: "/inventory/lots/LOT-01",
    routes: {
      "GET /api/v1/lots/": (request) => {
        const site = new URL(request.path, "https://test.invalid").searchParams.get(
          "custody_location",
        );
        if (site === b1) return ++visits === 1 ? obsolete.promise : current.promise;
        return Response.json(
          inventoryPage(
            denyA && !site
              ? []
              : [inventoryLot({ safety_location_id: site ?? inventoryLocation().id })],
          ),
        );
      },
      [`GET /api/v1/lots/${inventoryLot().id}/`]: (request) =>
        Response.json(
          inventoryLot({
            safety_location_id: new URL(request.path, "https://test.invalid").searchParams.get(
              "custody_location",
            ),
          }),
        ),
      "GET /api/v1/locations/placement-options/": () =>
        restoring ? action.promise : Response.json(inventoryPage([])),
    },
  });
  await user.type(
    await screen.findByRole("textbox", { name: "Observaciones" }),
    "Private admission draft",
  );
  const go = async (site?: string) => {
    await act(async () => {
      await app.router.navigate({
        to: "/inventory/lots/$code",
        params: { code: "LOT-01" },
        search: site === undefined ? {} : { custody_location: site },
      });
    });
  };
  await go(b1);
  await waitFor(() => {
    expect(visits).toBe(1);
  });
  expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
  await go(b2);
  await screen.findByText("Consulta de custodia · sólo lectura");
  expect(screen.queryByText("Private admission draft")).toBeNull();
  await go(b1);
  await waitFor(() => {
    expect(visits).toBe(2);
  });
  await act(async () => {
    obsolete.release(
      Response.json(
        inventoryPage([inventoryLot({ code: "OBSOLETE-CUSTODY", safety_location_id: b1 })]),
      ),
    );
    await obsolete.promise;
  });
  expect(screen.queryByText("OBSOLETE-CUSTODY")).toBeNull();
  expect(screen.queryByText("Consulta de custodia · sólo lectura")).toBeNull();
  act(() => {
    current.release(Response.json(inventoryPage([inventoryLot({ safety_location_id: b1 })])));
  });
  await screen.findByText("Consulta de custodia · sólo lectura");
  restoring = true;
  await act(async () => {
    await app.router.navigate({ to: "/inventory" });
  });
  const previousGates = api.requests.filter((request) =>
    request.path.includes("placement-options"),
  ).length;
  await go();
  await waitFor(() => {
    expect(
      api.requests.filter((request) => request.path.includes("placement-options")),
    ).toHaveLength(previousGates + 1);
  });
  expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
  restoring = false;
  act(() => {
    action.release(Response.json(inventoryPage([])));
  });
  expect(
    (await screen.findByRole<HTMLTextAreaElement>("textbox", { name: "Observaciones" })).value,
  ).toBe("Private admission draft");
  const requestsBeforeInvalid = api.requests.length;
  await go("");
  await screen.findByRole("heading", { name: "Contexto de custodia no válido" });
  expect(api.requests).toHaveLength(requestsBeforeInvalid);
  expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
  await go();
  expect(
    (await screen.findByRole<HTMLTextAreaElement>("textbox", { name: "Observaciones" })).value,
  ).toBe("Private admission draft");
  denyA = true;
  await go(b2);
  await screen.findByText("Consulta de custodia · sólo lectura");
  await go();
  await screen.findByRole("heading", { name: "No encontramos esta página" });
  denyA = false;
  await go(b2);
  await screen.findByText("Consulta de custodia · sólo lectura");
  await go();
  expect(
    (await screen.findByRole<HTMLTextAreaElement>("textbox", { name: "Observaciones" })).value,
  ).toBe("");
  expect(api.requests.filter((request) => request.method !== "GET")).toHaveLength(0);
});

test("a late admission conflict cannot replace a newer reconciled intent after a custody visit", async () => {
  const site = "cd000000-0000-0000-0000-000000000003";
  const oldReply = deferred();
  let current = inventoryLot();
  let writes = 0;
  const user = userEvent.setup();
  const { api, app } = await openInventory({
    path: "/inventory/lots/LOT-01",
    routes: {
      "GET /api/v1/lots/": (request) => {
        const custody = new URL(request.path, "https://test.invalid").searchParams.get(
          "custody_location",
        );
        return Response.json(
          inventoryPage([{ ...current, safety_location_id: custody ?? inventoryLocation().id }]),
        );
      },
      [`GET /api/v1/lots/${current.id}/`]: () =>
        Response.json({ ...current, safety_location_id: site }),
      [`PATCH /api/v1/lots/${current.id}/`]: (request) => {
        const body = request.body as { observations: string };
        current = inventoryLot({ revision: current.revision + 1, observations: body.observations });
        return ++writes === 1 ? oldReply.promise : Response.json(current);
      },
    },
  });
  const note = await screen.findByRole<HTMLTextAreaElement>("textbox", { name: "Observaciones" });
  await user.type(note, "First immutable command");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => {
    expect(writes).toBe(1);
  });
  await act(async () => {
    await app.router.navigate({
      to: "/inventory/lots/$code",
      params: { code: "LOT-01" },
      search: { custody_location: site },
    });
  });
  await screen.findByText("Consulta de custodia · sólo lectura");
  expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
  await act(async () => {
    await app.router.navigate({
      to: "/inventory/lots/$code",
      params: { code: "LOT-01" },
      search: {},
    });
  });
  await user.click(await screen.findByRole("button", { name: "Consultar el registro guardado" }));
  await waitFor(() => {
    expect(screen.queryByRole("button", { name: "Consultar el registro guardado" })).toBeNull();
  });
  const restored = await screen.findByRole<HTMLTextAreaElement>("textbox", {
    name: "Observaciones",
  });
  expect(restored.value).toBe("First immutable command");
  await user.clear(restored);
  await user.type(restored, "Newer explicit intent");
  await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => {
    expect(writes).toBe(2);
  });
  await screen.findByText("Guardado");
  const rejection = apiError(409, "inventory_revision_conflict");
  await act(async () => {
    oldReply.release(rejection);
    await oldReply.promise;
  });
  await waitFor(() => {
    expect(rejection.bodyUsed).toBe(true);
  });
  await waitFor(() => {
    expect(app.queryClient.isFetching()).toBe(0);
  });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Revisar versión actual y conservar captura" }),
  ).toBeNull();
  expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Observaciones" }).value).toBe(
    "Newer explicit intent",
  );
  expect(
    api.requests.filter((request) => request.method === "PATCH").map((request) => request.body),
  ).toMatchObject([
    { expected_revision: 2, observations: "First immutable command" },
    { expected_revision: 3, observations: "Newer explicit intent" },
  ]);
});

test.each(["conflict", "lost"] as const)(
  "an admission %s reply observed during a custody view retains its original command",
  async (outcome) => {
    const site = "cd000000-0000-0000-0000-000000000004";
    const reply = deferred();
    const user = userEvent.setup();
    const { api, app } = await openInventory({
      path: "/inventory/lots/LOT-01",
      routes: {
        "GET /api/v1/lots/": (request) => {
          const custody = new URL(request.path, "https://test.invalid").searchParams.get(
            "custody_location",
          );
          return Response.json(
            inventoryPage([
              inventoryLot({ safety_location_id: custody ?? inventoryLocation().id }),
            ]),
          );
        },
        [`GET /api/v1/lots/${inventoryLot().id}/`]: () =>
          Response.json(inventoryLot({ safety_location_id: site })),
        [`PATCH /api/v1/lots/${inventoryLot().id}/`]: () => reply.promise,
      },
    });
    await user.type(
      await screen.findByRole("textbox", { name: "Observaciones" }),
      "Private original command",
    );
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => {
      expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1);
    });
    await act(async () => {
      await app.router.navigate({
        to: "/inventory/lots/$code",
        params: { code: "LOT-01" },
        search: { custody_location: site },
      });
    });
    await screen.findByText("Consulta de custodia · sólo lectura");
    await act(async () => {
      if (outcome === "conflict") reply.release(apiError(409, "inventory_revision_conflict"));
      else reply.refuse(new TypeError("Synthetic lost reply"));
      await reply.promise.catch(() => undefined);
    });
    expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    api.setRoute("GET /api/v1/lots/", (request) =>
      new URL(request.path, "https://test.invalid").searchParams.has("custody_location")
        ? apiError(404, "not_found")
        : Response.json(inventoryPage([inventoryLot()])),
    );
    await user.click(screen.getByRole("button", { name: "Actualizar estado" }));
    await screen.findByRole("heading", { name: "Custodia no disponible" });
    await act(async () => {
      await app.router.navigate({
        to: "/inventory/lots/$code",
        params: { code: "LOT-01" },
        search: {},
      });
    });
    await screen.findByRole("button", {
      name:
        outcome === "conflict"
          ? "Revisar versión actual y conservar captura"
          : "Consultar el registro guardado",
    });
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Observaciones" }).value).toBe(
      "Private original command",
    );
    const writes = api.requests.filter((request) => request.method !== "GET");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.body).toMatchObject({
      expected_revision: 2,
      observations: "Private original command",
    });
  },
);

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
    await screen.findByRole("combobox", { name: "Centro" });
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
      await screen.findByRole("combobox", { name: "Centro" });
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
