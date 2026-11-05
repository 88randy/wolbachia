import { invalidateCatalogs } from "./catalogs-query";
import { act, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { apiError, createFakeApi, makeMe } from "../test/fake-api";
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
import { acceptSession } from "../session/session-revision";
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

test.each(["none", "create", "update", "deactivate", "activate"])(
  "each catalog permission gates only its own controls: %s",
  async (action) => {
    const permissions =
      action === "none" ? ["catalog.read"] : ["catalog.read", `catalog_item.${action}`];
    await open({ permissions, path: `${CATALOG_PATH}?include_deactivated=true` });
    const controls = [
      { name: "Agregar elemento", permission: "create" },
      { name: "Editar", permission: "update" },
      { name: "Mover arriba: Rociado", permission: "update" },
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
test("permitted moves are disabled at the ends and fixed Other has no actions", async () => {
  await open();
  expect(screen.getByRole("button", { name: "Mover arriba: Rociado" }).getAttribute("title")).toBe(
    "Ya es el primer elemento activo.",
  );
  const other = screen.getByRole("row", { name: /Otro \(especificar\)/ });
  expect(within(other).queryByRole("button")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Mover abajo: Nebulización" }).getAttribute("title"),
  ).toBe("Ya es el último elemento activo.");
});

test("deactivated visibility is URL synced and English fallback is warned on the row and form", async () => {
  const { app } = await open({
    rows: [makeCatalogItem({ label_en: "" }), ...catalogRows().slice(1)],
    language: "en",
  });
  expect(screen.queryByText("Previous")).toBeNull();
  expect(
    within(screen.getByRole("row", { name: /spraying/ })).getByText(
      "No English label: using Spanish.",
    ),
  ).toBeDefined();
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Include deactivated"));
  await waitFor(() => {
    expect(app.router.state.location.search).toMatchObject({ include_deactivated: "true" });
  });
  expect(await screen.findByText("Previous")).toBeDefined();
  await user.click(
    within(screen.getByRole("row", { name: /spraying/ })).getByRole("button", { name: "Edit" }),
  );
  expect(
    within(screen.getByRole("dialog")).getByText("No English label: using Spanish."),
  ).toBeDefined();
});

test("deactivation confirms without reason, returns focus on cancel, and reactivation is direct", async () => {
  let rows = catalogRows();
  const { api } = await open({
    routes: {
      [`GET ${ITEMS_PATH}`]: () => pageOf(rows),
      [`POST ${ITEMS_PATH}item-a/deactivate/`]: () => {
        rows = rows.map((item) => (item.id === "item-a" ? { ...item, is_active: false } : item));
        return Response.json(makeCatalogItem({ is_active: false }));
      },
      [`POST ${ITEMS_PATH}item-a/activate/`]: () => {
        rows = rows.map((item) => (item.id === "item-a" ? { ...item, is_active: true } : item));
        return Response.json(makeCatalogItem());
      },
    },
  });
  const user = userEvent.setup();
  const opener = within(screen.getByRole("row", { name: /spraying/ })).getByRole("button", {
    name: "Desactivar",
  });
  await user.click(opener);
  expect(within(screen.getByRole("dialog")).queryByRole("textbox")).toBeNull();
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
  expect(document.activeElement).toBe(opener);
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
  await user.click(opener);
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desactivar" }));
  await waitFor(() => {
    expect(screen.queryByRole("row", { name: /spraying/ })).toBeNull();
  });
  await user.click(screen.getByLabelText("Incluir desactivados"));
  const inactive = await screen.findByRole("row", { name: /spraying/ });
  expect(within(inactive).getByText("Desactivado")).toBeDefined();
  await user.click(within(inactive).getByRole("button", { name: "Reactivar" }));
  await waitFor(() => {
    expect(within(screen.getByRole("row", { name: /spraying/ })).getByText("Activo")).toBeDefined();
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    api.requests.filter((request) => request.method === "POST").map((request) => request.body),
  ).toEqual([undefined, undefined]);
});
test("late submit after a session change keeps the draft and does not refetch catalogs", async () => {
  let resolve!: (answer: Response) => void;
  const answer = new Promise<Response>((done) => {
    resolve = done;
  });
  const { api } = await open({ routes: { [`POST ${ITEMS_PATH}`]: () => answer } });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Agregar elemento" }));
  await user.type(screen.getByLabelText("Código"), "new");
  await user.type(screen.getByLabelText("Etiqueta en español (obligatoria)"), "Nueva");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => {
    expect(api.requests.some((request) => request.method === "POST")).toBe(true);
  });
  const reads = api.requests.filter((request) => request.method === "GET").length;
  acceptSession();
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

test("a partial reorder failure refetches the server order and shows an alert", async () => {
  const { api } = await open({
    routes: {
      [`PATCH ${ITEMS_PATH}item-b/`]: Response.json(makeCatalogItem()),
      [`PATCH ${ITEMS_PATH}item-a/`]: apiError(400, "validation_error", {
        fields: { sort: [{ code: "sort_exhausted" }] },
      }),
    },
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Mover arriba: Nebulización" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "No se pudo completar el cambio de orden. Se recargó la lista; revísala antes de reintentar.",
  );
  expect(
    api.requests.filter((request) => request.method === "PATCH").map((request) => request.body),
  ).toEqual([{ sort: 10 }, { sort: 20 }]);
  expect(
    api.requests.filter(
      (request) => request.method === "GET" && request.path.startsWith(ITEMS_PATH),
    ).length,
  ).toBeGreaterThan(1);
});

test("fetches all catalog and item pages without following arbitrary next URLs", async () => {
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(CATALOG_ADMIN),
    "GET /api/v1/catalogs/": (request) => {
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
    [`GET ${ITEMS_PATH}`]: (request) =>
      Response.json({
        count: 2,
        next: request.path.includes("page=2") ? null : "/items/?page=2",
        previous: null,
        results: request.path.includes("page=2")
          ? [makeCatalogItem({ id: "last", code: "last", label_es: "Último", sort: 20 })]
          : [makeCatalogItem()],
      }),
  });
  await renderApp({ path: CATALOG_PATH, fetch: api.fetch });
  expect(await screen.findByText("Último")).toBeDefined();
  expect(screen.getByRole("link", { name: "Intervenciones" }).getAttribute("aria-current")).toBe(
    "page",
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

test("a session change between reorder PATCHes stops remaining writes and invalidation", async () => {
  let resolve!: (answer: Response) => void;
  const answer = new Promise<Response>((done) => {
    resolve = done;
  });
  const { api } = await open({ routes: { [`PATCH ${ITEMS_PATH}item-b/`]: () => answer } });
  const user = userEvent.setup();
  const move = screen.getByRole("button", { name: "Mover arriba: Nebulización" });
  await user.click(move);
  await waitFor(() => {
    expect(api.requests.some((request) => request.method === "PATCH")).toBe(true);
  });
  const reads = api.requests.filter((request) => request.method === "GET").length;
  acceptSession();
  resolve(Response.json(makeCatalogItem()));
  await waitFor(() => {
    expect(move.getAttribute("aria-disabled")).toBe("false");
  });
  expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1);
  expect(api.requests.filter((request) => request.method === "GET")).toHaveLength(reads);
  expect(screen.queryByText("Se movió Nebulización arriba.")).toBeNull();
});

test("an add draft survives a failed catalog refetch and the notice can retry", async () => {
  let resolveRefetch!: (answer: Response) => void;
  const pendingRefetch = new Promise<Response>((resolve) => {
    resolveRefetch = resolve;
  });
  const { api, app } = await open();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Agregar elemento" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Código"), "draft-code");
  await user.type(within(dialog).getByLabelText("Etiqueta en español (obligatoria)"), "Borrador");
  api.setRoute("GET /api/v1/catalogs/", () => pendingRefetch);
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
    ).toHaveLength(reads + 1);
  });
  await act(async () => {
    resolveRefetch(apiError(503, "server_error"));
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
