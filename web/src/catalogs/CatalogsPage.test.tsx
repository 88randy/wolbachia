import { installTableGeometry } from "../test/table-geometry";
import { invalidateCatalogs } from "./catalogs-query";
import { act, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { apiError, createFakeApi, makeMe, FAKE_IDENTITY } from "../test/fake-api";
import { commitKnown, readToken } from "../session/session-controller";
import type { FakeApiRoutes } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import { pageOf } from "../test/rules-fixtures";
import {
  CATALOG,
  CATALOG_ADMIN,
  CATALOG_PATH,
  ITEMS_PATH,
  catalogRows,
  makeCatalogItem,
} from "../test/catalog-fixtures";
import { bumpEpoch } from "../session/session-revision";
import type { CatalogItem } from "./catalogs-query";

async function open(
  options: {
    permissions?: string[];
    rows?: CatalogItem[];
    routes?: FakeApiRoutes;
    language?: "en";
    path?: string;
  } = {},
) {
  const me = options.permissions ? makeMe({ permissions: options.permissions }) : CATALOG_ADMIN;
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(me),
    "GET /api/v1/catalogs/": () => pageOf([CATALOG]),
    [`GET ${ITEMS_PATH}`]: () => pageOf(options.rows ?? catalogRows()),
    ...options.routes,
  });
  const app = await renderApp({
    path: options.path ?? CATALOG_PATH,
    fetch: api.fetch,
    me,
    ...(options.language ? { language: options.language } : {}),
  });
  await screen.findByRole("row", { name: /spraying/ });
  return { api, app };
}

beforeEach(() => {
  installTableGeometry();
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function keyboardMove(name: string) {
  const user = userEvent.setup();
  const handle = screen.getByRole("button", { name: `Reordenar: ${name}` });
  handle.focus();
  await user.keyboard("[Space]");
  await waitFor(() => {
    expect(handle.getAttribute("aria-pressed")).toBe("true");
  });
  await user.keyboard("[ArrowUp]");
  await user.keyboard("[Space]");
}

test.each(["none", "create", "update", "deactivate", "activate"])(
  "each catalog permission gates only its own controls: %s",
  async (action) => {
    const permissions =
      action === "none" ? ["catalog.read"] : ["catalog.read", `catalog_item.${action}`];
    await open({ permissions, path: `${CATALOG_PATH}?include_deactivated=true` });
    const controls = [
      { name: "Agregar elemento", permission: "create" },
      { name: "Editar", permission: "update" },
      { name: "Reordenar: Rociado", permission: "update" },
      { name: "Desactivar", permission: "deactivate" },
      { name: "Reactivar", permission: "activate" },
    ];
    for (const control of controls) {
      expect(screen.queryAllByRole("button", { name: control.name }).length > 0).toBe(
        action === control.permission,
      );
    }
  },
);
test("fixed Other has no actions and keyboard handles replace text moves", async () => {
  await open();
  expect(screen.getByRole("button", { name: "Reordenar: Rociado" })).toBeDefined();
  expect(screen.queryByRole("button", { name: /Mover arriba|Mover abajo/ })).toBeNull();
  expect(
    within(screen.getByRole("row", { name: /Otro \(especificar\)/ })).queryByRole("button"),
  ).toBeNull();
});
test("availability is announced by segments and English fallback remains editable", async () => {
  await open({
    rows: [makeCatalogItem({ label_en: "" }), ...catalogRows().slice(1)],
    language: "en",
    path: `${CATALOG_PATH}?is_active=all`,
  });
  expect(screen.getByText("Previous")).toBeDefined();
  const availability = within(screen.getByRole("group", { name: "Status" }));
  expect(availability.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(availability.getByRole("button", { name: "Active" }).getAttribute("aria-pressed")).toBe(
    "false",
  );
  const row = screen.getByRole("row", { name: /spraying/ });
  expect(within(row).getByText("No English label: using Spanish.")).toBeDefined();
  await userEvent.setup().click(within(row).getByRole("button", { name: "Edit" }));
  expect(
    within(screen.getByRole("dialog")).getByText("No English label: using Spanish."),
  ).toBeDefined();
});
test.each([
  { isActive: true, grants: "both" },
  { isActive: false, grants: "both" },
  { isActive: true, grants: "initial-only" },
  { isActive: false, grants: "initial-only" },
  { isActive: true, grants: "revoked" },
  { isActive: false, grants: "revoked" },
])(
  "availability $isActive Undo requires its own current inverse grant: $grants",
  async ({ isActive, grants }) => {
    const initial = isActive ? "deactivate" : "activate";
    const inverse = isActive ? "activate" : "deactivate";
    const permissions = ["catalog.read", `catalog_item.${initial}`];
    let rows = catalogRows().map((item) =>
      item.id === "item-a" ? { ...item, is_active: isActive } : item,
    );
    const { api, app } = await open({
      permissions:
        grants === "initial-only" ? permissions : [...permissions, `catalog_item.${inverse}`],
      path: `${CATALOG_PATH}?is_active=all`,
      routes: {
        [`GET ${ITEMS_PATH}`]: () => pageOf(rows),
        [`POST ${ITEMS_PATH}item-a/${initial}/`]: () => {
          rows = rows.map((item) => ({
            ...item,
            catalog_version: 1,
            is_active: item.id === "item-a" ? !isActive : item.is_active,
          }));
          return Response.json(makeCatalogItem({ is_active: !isActive, catalog_version: 1 }));
        },
        [`POST ${ITEMS_PATH}item-a/${inverse}/`]: () => {
          rows = rows.map((item) => ({
            ...item,
            catalog_version: 2,
            is_active: item.id === "item-a" ? isActive : item.is_active,
          }));
          return Response.json(makeCatalogItem({ is_active: isActive, catalog_version: 2 }));
        },
      },
    });
    const user = userEvent.setup();
    await user.click(
      within(screen.getByRole("row", { name: /spraying/ })).getByRole("button", {
        name: isActive ? "Desactivar" : "Reactivar",
      }),
    );
    await screen.findAllByText("Cambios guardados.");
    if (grants === "initial-only") {
      expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull();
      expect(
        api.requests.filter((request) => request.method === "POST").map((request) => request.body),
      ).toEqual([{ version: 0 }]);
      return;
    }
    const undo = screen.getByRole("button", { name: "Deshacer" });
    expect(
      within(screen.getByRole("row", { name: /spraying/ })).getByText(
        isActive ? "Desactivado" : "Activo",
      ),
    ).toBeDefined();
    if (grants === "revoked") {
      const me = makeMe({ permissions });
      api.setRoute("GET /api/v1/me/", Response.json(me));
      act(() => {
        expect(
          commitKnown(app.queryClient, readToken(), {
            me,
            attestation: FAKE_IDENTITY,
            passive: true,
          }),
        ).toBe(true);
      });
      await user.click(undo);
      expect(
        api.requests.filter((request) => request.method === "POST").map((request) => request.body),
      ).toEqual([{ version: 0 }]);
      return;
    }
    await user.click(undo);
    await waitFor(() => {
      expect(
        within(screen.getByRole("row", { name: /spraying/ })).getByText(
          isActive ? "Activo" : "Desactivado",
        ),
      ).toBeDefined();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      api.requests.filter((request) => request.method === "POST").map((request) => request.body),
    ).toEqual([{ version: 0 }, { version: 1 }]);
  },
);

test("a late submit after a same-identity revision change keeps the draft without extra refetches", async () => {
  let resolve!: (answer: Response) => void;
  const answer = new Promise<Response>((done) => {
    resolve = done;
  });
  const { api, app } = await open({ routes: { [`POST ${ITEMS_PATH}`]: () => answer } });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Agregar elemento" }));
  await user.type(screen.getByLabelText("Código"), "new");
  await user.type(screen.getByLabelText("Etiqueta en español (obligatoria)"), "Nueva");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => {
    expect(api.requests.some((request) => request.method === "POST")).toBe(true);
  });
  await act(async () => {
    bumpEpoch();
    await Promise.resolve();
  });
  // The session owns the epoch's read restart; only the late write must not add another one.
  await waitFor(() => {
    expect(app.queryClient.isFetching()).toBe(0);
  });
  const reads = api.requests.filter((request) => request.method === "GET").length;
  resolve(Response.json(makeCatalogItem()));
  await waitFor(() => {
    expect(
      screen.getByLabelText<HTMLInputElement>("Etiqueta en español (obligatoria)").disabled,
    ).toBe(false);
  });
  expect(screen.getByLabelText<HTMLInputElement>("Etiqueta en español (obligatoria)").value).toBe(
    "Nueva",
  );
  expect(api.requests.filter((request) => request.method === "GET")).toHaveLength(reads);
});

test("reorder sends one conditional POST and displays the refreshed order", async () => {
  let rows = catalogRows().map((item) => ({ ...item, catalog_version: 4 }));
  let version = 4;
  const { api } = await open({
    routes: {
      "GET /api/v1/catalogs/": () => pageOf([{ ...CATALOG, version }]),
      [`GET ${ITEMS_PATH}`]: () => pageOf(rows),
      [`POST ${ITEMS_PATH}reorder/`]: () => {
        version += 1;
        rows = [...rows.slice(1, 2), ...rows.slice(0, 1), ...rows.slice(2)].map((item) => ({
          ...item,
          catalog_version: version,
        }));
        return Response.json({ version, items: rows });
      },
    },
  });
  await keyboardMove("Nebulización");
  await waitFor(() => {
    expect(screen.getAllByRole("row")[1]?.textContent).toContain("Nebulización");
  });
  const writes = api.requests
    .filter((request) => request.method !== "GET")
    .map(({ path, method, body }) => ({ path, method, body }));
  expect(writes).toEqual([
    {
      path: `${ITEMS_PATH}reorder/`,
      method: "POST",
      body: { version: 4, ordered_ids: ["item-b", "item-a"] },
    },
  ]);
});

test("a stale reorder refetches both queries and asks to retry without showing server text", async () => {
  const { api } = await open({
    routes: { [`POST ${ITEMS_PATH}reorder/`]: apiError(409, "catalog_version_conflict") },
  });
  await keyboardMove("Nebulización");
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "El catálogo cambió. Se recargó la lista; revisa el orden e intenta de nuevo.",
  );
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  expect(api.requests.some((request) => request.method === "PATCH")).toBe(false);
  expect(
    api.requests.filter(
      (request) => request.method === "GET" && request.path.startsWith(ITEMS_PATH),
    ).length,
  ).toBeGreaterThan(1);
  expect(
    api.requests.filter(
      (request) => request.method === "GET" && request.path.startsWith("/api/v1/catalogs/?"),
    ).length,
  ).toBeGreaterThan(1);
});

test("table shows usage, creation author and deactivation actor and date", async () => {
  await open({
    path: `${CATALOG_PATH}?include_deactivated=true`,
    rows: [
      makeCatalogItem({ usage_count: 4, in_use: true, created_by_username: "test-author" }),
      makeCatalogItem({
        id: "old",
        code: "old",
        label_es: "Anterior",
        is_active: false,
        deactivated_at: "2026-02-05T12:00:00Z",
        deactivated_by_username: "test-editor",
      }),
    ],
  });
  const used = within(screen.getByRole("row", { name: /spraying/ }));
  expect(used.getByText("4")).toBeDefined();
  expect(used.getByText(/test-author/)).toBeDefined();
  const inactive = within(screen.getByRole("row", { name: /Anterior/ }));
  expect(inactive.getByText(/test-editor/)).toBeDefined();
  expect(inactive.getByText(/5.*feb.*2026/)).toBeDefined();
});

test("fetches all catalog and item pages without following arbitrary next URLs", async () => {
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(CATALOG_ADMIN),
    "GET /api/v1/catalogs/": (request) => {
      if (new URL(request.path, "http://api.invalid").searchParams.get("page_size") === "25")
        return pageOf([
          { ...CATALOG, slug: "closed", label_es: "Cerrado", is_open: false },
          CATALOG,
        ]);
      const second = request.path.includes("page=2");
      return Response.json({
        count: 2,
        next: second ? null : "https://ignored.example/page=2",
        previous: null,
        results: second
          ? [CATALOG]
          : [{ ...CATALOG, slug: "closed", label_es: "Cerrado", is_open: false }],
      });
    },
    [`GET ${ITEMS_PATH}`]: (request) => {
      if (new URL(request.path, "http://api.invalid").searchParams.get("page_size") === "25")
        return pageOf([
          makeCatalogItem(),
          makeCatalogItem({ id: "last", code: "last", label_es: "Último", sort: 20 }),
        ]);
      return Response.json({
        count: 2,
        next: request.path.includes("page=2") ? null : "/items/?page=2",
        previous: null,
        results: request.path.includes("page=2")
          ? [makeCatalogItem({ id: "last", code: "last", label_es: "Último", sort: 20 })]
          : [makeCatalogItem()],
      });
    },
  });
  await renderApp({ path: CATALOG_PATH, fetch: api.fetch });
  expect(await screen.findByText("Último")).toBeDefined();
  expect(screen.getByRole("combobox", { name: "Catálogos disponibles" }).textContent).toContain(
    "Intervenciones",
  );
  expect(api.requests.filter((request) => request.path.includes("page=2"))).toHaveLength(2);
  expect(screen.queryByRole("button", { name: /Siguiente/ })).toBeNull();
});

test.each(["/settings/catalogs", CATALOG_PATH])(
  "catalog.read gates %s before any catalog fetch",
  async (path) => {
    const me = makeMe({ permissions: ["catalog_item.create"] });
    const api = createFakeApi({ "GET /api/v1/me/": Response.json(me) });
    await renderApp({ path, fetch: api.fetch });
    await screen.findByText("No tienes acceso a esta sección");
    expect(api.requests.some((request) => request.path.startsWith("/api/v1/catalogs/"))).toBe(
      false,
    );
  },
);

test("an empty catalog list stays at the index without opening an item editor", async () => {
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(CATALOG_ADMIN),
    "GET /api/v1/catalogs/": Response.json({ count: 0, results: [] }),
  });
  const app = await renderApp({ path: "/settings/catalogs", fetch: api.fetch });
  expect(await screen.findByText("Todavía no hay catálogos disponibles.")).toBeDefined();
  expect(app.router.state.location.pathname).toBe("/settings/catalogs");
  expect(screen.queryByRole("button", { name: "Agregar elemento" })).toBeNull();
});

test("create and edit send only contract fields and preserve immutable codes", async () => {
  let rows = catalogRows();
  const { api } = await open({
    routes: {
      [`GET ${ITEMS_PATH}`]: () => pageOf(rows),
      [`POST ${ITEMS_PATH}`]: () => {
        rows = [
          ...rows,
          makeCatalogItem({ id: "created", code: "new", label_es: "Nueva", label_en: "" }),
        ];
        return Response.json(rows.at(-1), { status: 201 });
      },
      [`PATCH ${ITEMS_PATH}created/`]: () => {
        rows = rows.map((item) =>
          item.id === "created" ? { ...item, label_es: "Actualizada" } : item,
        );
        return Response.json(rows.find((item) => item.id === "created"));
      },
    },
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Agregar elemento" }));
  await user.type(screen.getByLabelText("Código"), "new");
  await user.type(screen.getByLabelText("Etiqueta en español (obligatoria)"), "Nueva");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  const row = await screen.findByRole("row", { name: /Nueva/ });
  await user.click(within(row).getByRole("button", { name: "Editar" }));
  expect(screen.queryByLabelText("Código")).toBeNull();
  await user.clear(screen.getByLabelText("Etiqueta en español (obligatoria)"));
  await user.type(screen.getByLabelText("Etiqueta en español (obligatoria)"), "Actualizada");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await screen.findByRole("row", { name: /Actualizada/ });
  expect(api.requests.find((request) => request.method === "POST")?.body).toEqual({
    code: "new",
    sort: 30,
    label_es: "Nueva",
    label_en: "",
  });
  expect(api.requests.find((request) => request.method === "PATCH")?.body).toEqual({
    label_es: "Actualizada",
    label_en: "",
  });
});

test("unmount aborts an in-flight submit", async () => {
  let resolve!: (answer: Response) => void;
  const answer = new Promise<Response>((done) => {
    resolve = done;
  });
  const { app, api } = await open({ routes: { [`POST ${ITEMS_PATH}`]: () => answer } });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Agregar elemento" }));
  await user.type(screen.getByLabelText("Código"), "new");
  await user.type(screen.getByLabelText("Etiqueta en español (obligatoria)"), "Nueva");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => {
    expect(api.requests.some((request) => request.method === "POST")).toBe(true);
  });
  const sent = api.requests.find((request) => request.method === "POST");
  app.unmount();
  expect(sent?.signal.aborted).toBe(true);
  const reads = api.requests.filter((request) => request.method === "GET").length;
  resolve(Response.json(makeCatalogItem()));
  await answer;
  expect(api.requests.filter((request) => request.method === "GET")).toHaveLength(reads);
});

test("a session revision change during the reorder POST drops its answer and extra invalidation", async () => {
  let resolve!: (answer: Response) => void;
  const answer = new Promise<Response>((done) => {
    resolve = done;
  });
  const { api, app } = await open({ routes: { [`POST ${ITEMS_PATH}reorder/`]: () => answer } });
  const move = screen.getByRole("button", { name: "Reordenar: Nebulización" });
  await keyboardMove("Nebulización");
  await waitFor(() => {
    expect(api.requests.some((request) => request.method === "POST")).toBe(true);
  });
  await act(async () => {
    bumpEpoch();
    await Promise.resolve();
  });
  // The session owns the epoch's read restart; only the late write must not add another one.
  await waitFor(() => {
    expect(app.queryClient.isFetching()).toBe(0);
  });
  const reads = api.requests.filter((request) => request.method === "GET").length;
  resolve(Response.json({ version: 2, items: [] }));
  await waitFor(() => {
    expect(move.getAttribute("aria-disabled")).toBe("false");
  });
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  expect(api.requests.filter((request) => request.method === "GET")).toHaveLength(reads);
  expect(screen.queryByText("Se movió Nebulización arriba.")).toBeNull();
  expect(screen.getAllByRole("row")[1]?.textContent).toContain("Rociado");
});

test("an add draft survives a failed catalog refetch and one retry refreshes both navigation queries", async () => {
  let resolveRefetch!: () => void;
  const pendingRefetch = new Promise<void>((resolve) => {
    resolveRefetch = resolve;
  });
  const { api, app } = await open();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Agregar elemento" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Código"), "draft-code");
  await user.type(within(dialog).getByLabelText("Etiqueta en español (obligatoria)"), "Borrador");
  api.setRoute("GET /api/v1/catalogs/", async () => {
    await pendingRefetch;
    return apiError(503, "server_error");
  });
  const reads = api.requests.filter((request) =>
    request.path.startsWith("/api/v1/catalogs/?"),
  ).length;
  let refresh!: Promise<void>;
  act(() => {
    refresh = invalidateCatalogs(app.queryClient);
  });
  await waitFor(() => {
    expect(
      api.requests.filter((request) => request.path.startsWith("/api/v1/catalogs/?")),
    ).toHaveLength(reads + 2);
  });
  await act(async () => {
    resolveRefetch();
    await refresh;
  });
  const notice = await screen.findByText(
    "No pudimos actualizar los catálogos. Conservamos la información anterior. Reintenta.",
  );
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(within(dialog).getByLabelText<HTMLInputElement>("Código").value).toBe("draft-code");
  expect(
    within(dialog).getByLabelText<HTMLInputElement>("Etiqueta en español (obligatoria)").value,
  ).toBe("Borrador");
  await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  api.setRoute("GET /api/v1/catalogs/", () => pageOf([CATALOG]));
  await user.click(screen.getByRole("button", { name: "Reintentar" }));
  await waitFor(() => {
    expect(notice.isConnected).toBe(false);
  });
  expect(screen.getByRole("row", { name: /spraying/ })).toBeDefined();
});

test("create sends an explicit sort despite an inactive item at the backend maximum", async () => {
  let resolveCreate!: (answer: Response) => void;
  const pendingCreate = new Promise<Response>((resolve) => {
    resolveCreate = resolve;
  });
  let rows = catalogRows().map((item) => (item.is_active ? item : { ...item, sort: 10000 }));
  const created = makeCatalogItem({
    id: "created",
    code: "new",
    label_es: "Nueva",
    label_en: "",
    sort: 30,
  });
  const { api } = await open({
    routes: {
      [`GET ${ITEMS_PATH}`]: () => pageOf(rows),
      [`POST ${ITEMS_PATH}`]: () => pendingCreate,
    },
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Agregar elemento" }));
  await user.type(screen.getByLabelText("Código"), "new");
  await user.type(screen.getByLabelText("Etiqueta en español (obligatoria)"), "Nueva");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => {
    expect(api.requests.some((request) => request.method === "POST")).toBe(true);
  });
  await act(async () => {
    rows = [...rows, created];
    resolveCreate(Response.json(created, { status: 201 }));
    await pendingCreate;
  });
  await screen.findByRole("row", { name: /Nueva/ });
  expect(api.requests.find((request) => request.method === "POST")?.body).toEqual({
    code: "new",
    label_es: "Nueva",
    label_en: "",
    sort: 30,
  });
});

function deferredCatalogRead() {
  let release!: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test("reorder uses the oldest item-page revision even when the catalog query is newer", async () => {
  const catalogs = deferredCatalogRead();
  const firstPage = deferredCatalogRead();
  const secondPage = deferredCatalogRead();
  const older = catalogRows().map((item) => ({ ...item, catalog_version: 1 }));
  const newer = older.map((item) => ({ ...item, catalog_version: 2 }));
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(CATALOG_ADMIN),
    "GET /api/v1/catalogs/": () => catalogs.promise.then((response) => response.clone()),
    [`GET ${ITEMS_PATH}`]: (request) =>
      (request.path.includes("page=2") ? secondPage : firstPage).promise.then((response) =>
        response.clone(),
      ),
    [`POST ${ITEMS_PATH}reorder/`]: apiError(409, "catalog_version_conflict"),
  });
  await renderApp({ path: CATALOG_PATH, fetch: api.fetch });
  await waitFor(() => {
    expect(api.requests.some((request) => request.path.startsWith("/api/v1/catalogs/?"))).toBe(
      true,
    );
  });
  await act(async () => {
    catalogs.release(pageOf([{ ...CATALOG, version: 2 }]));
    await catalogs.promise;
  });
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: "Catálogos disponibles" }).textContent).toContain(
      "Intervenciones",
    );
  });
  await act(async () => {
    firstPage.release(
      Response.json({
        count: older.length,
        next: `${ITEMS_PATH}?page=2`,
        previous: null,
        results: older.slice(0, 2),
      }),
    );
    await firstPage.promise;
  });
  await waitFor(() => {
    expect(api.requests.some((request) => request.path.includes("page=2"))).toBe(true);
  });
  await act(async () => {
    secondPage.release(pageOf(newer.slice(2)));
    await secondPage.promise;
  });
  await screen.findByRole("row", { name: /spraying/ });
  await keyboardMove("Nebulización");
  await screen.findByRole("alert");
  expect(
    api.requests.filter((request) => request.method === "POST").map((request) => request.body),
  ).toEqual([{ version: 1, ordered_ids: ["item-b", "item-a"] }]);
});

test("a background refresh during drag cannot replace the revision of the displayed order", async () => {
  let rows = catalogRows().map((item) => ({ ...item, catalog_version: 1 }));
  const { api, app } = await open({
    routes: {
      [`GET ${ITEMS_PATH}`]: () => pageOf(rows),
      [`POST ${ITEMS_PATH}reorder/`]: apiError(409, "catalog_version_conflict"),
    },
  });
  const user = userEvent.setup();
  const handle = screen.getByRole("button", { name: "Reordenar: Nebulización" });
  handle.focus();
  await user.keyboard("[Space]");
  await waitFor(() => {
    expect(handle.getAttribute("aria-pressed")).toBe("true");
  });
  rows = rows.map((item) => ({
    ...item,
    catalog_version: 2,
    label_es: item.id === "item-a" ? "Updated elsewhere" : item.label_es,
  }));
  await act(async () => {
    await invalidateCatalogs(app.queryClient);
  });
  expect(screen.queryByText("Updated elsewhere")).toBeNull();
  await user.keyboard("[ArrowUp]");
  await user.keyboard("[Space]");
  await screen.findByRole("alert");
  expect(
    api.requests.filter((request) => request.method === "POST").map((request) => request.body),
  ).toEqual([{ version: 1, ordered_ids: ["item-b", "item-a"] }]);
  expect(await screen.findByText("Updated elsewhere")).toBeDefined();
});
test("Undo compares our returned revision and never adopts a later editor's version", async () => {
  let version = 4;
  let rows = catalogRows();
  const { api, app } = await open({
    routes: {
      [`GET ${ITEMS_PATH}`]: () =>
        pageOf(rows.map((item) => ({ ...item, catalog_version: version }))),
      [`POST ${ITEMS_PATH}reorder/`]: (request) => {
        const body = request.body as { version: number };
        if (body.version !== version) return apiError(409, "catalog_version_conflict");
        version += 1;
        rows = [...rows.slice(0, 2).reverse(), ...rows.slice(2)];
        return Response.json({ version, items: rows });
      },
    },
  });
  await keyboardMove("Nebulización");
  await screen.findByRole("button", { name: "Deshacer" });
  version = 6;
  await act(async () => {
    await invalidateCatalogs(app.queryClient);
  });
  await userEvent.setup().click(screen.getByRole("button", { name: "Deshacer" }));
  await screen.findByRole("alert");
  expect(
    api.requests.filter((request) => request.method === "POST").map((request) => request.body),
  ).toEqual([
    { version: 4, ordered_ids: ["item-b", "item-a"] },
    { version: 5, ordered_ids: ["item-a", "item-b"] },
  ]);
  expect(version).toBe(6);
});

test("reauthentication cancels an older drag, restores its DOM order and sends no write", async () => {
  const { api, app } = await open();
  const user = userEvent.setup();
  const handle = screen.getByRole("button", { name: "Reordenar: Nebulización" });
  handle.focus();
  await user.keyboard("[Space]");
  await waitFor(() => {
    expect(handle.getAttribute("aria-pressed")).toBe("true");
  });
  await user.keyboard("[ArrowUp]");
  await waitFor(() => {
    expect(screen.getAllByRole("row")[1]?.textContent).toContain("Nebulización");
  });
  await act(async () => {
    bumpEpoch();
    await Promise.resolve();
  });
  await waitFor(() => {
    expect(app.queryClient.isFetching()).toBe(0);
  });
  await waitFor(() => {
    expect(handle.getAttribute("aria-pressed")).toBe("false");
  });
  await waitFor(() => {
    expect(screen.getAllByRole("row")[1]?.textContent).toContain("Rociado");
  });
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
});
