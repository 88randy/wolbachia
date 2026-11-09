import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { apiError, createFakeApi } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import { installTableGeometry } from "../test/table-geometry";
import {
  CATALOG,
  CATALOG_ADMIN,
  CATALOG_PATH,
  ITEMS_PATH,
  catalogRows,
  makeCatalogItem,
} from "../test/catalog-fixtures";
afterEach(() => {
  vi.restoreAllMocks();
});

test("catalog search/order/page are server-owned and a filtered view cannot publish an incomplete reorder", async () => {
  const rows = Array.from({ length: 26 }, (_, index) =>
    makeCatalogItem({
      id: `item-${String(index)}`,
      code: `code-${String(index)}`,
      label_es: index === 25 ? "Último Rociado" : `Rociado ${String(index)}`,
      sort: index * 10,
    }),
  );
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(CATALOG_ADMIN),
    "GET /api/v1/catalogs/": () =>
      Response.json({ count: 1, results: [CATALOG], next: null, previous: null }),
    [`GET ${ITEMS_PATH}`]: ({ path }) => {
      const query = new URL(path, "http://api.invalid").searchParams;
      return Response.json({
        count: rows.length,
        next: null,
        previous: null,
        results: query.has("search") ? rows.slice(25) : rows,
      });
    },
  });
  await renderApp({
    path: `${CATALOG_PATH}?search=Rociado&ordering=-usage_count&page=2&include_deactivated=true`,
    fetch: api.fetch,
  });
  await waitFor(() => {
    const queries = api.requests
      .filter((request) => request.path.startsWith(ITEMS_PATH))
      .map((request) => new URL(request.path, "http://api.invalid").searchParams);
    expect(
      queries.some(
        (query) =>
          query.get("page") === "2" &&
          query.get("search") === "Rociado" &&
          query.get("ordering") === "-usage_count" &&
          !query.has("is_active"),
      ),
    ).toBe(true);
    expect(
      queries.some(
        (query) =>
          query.get("page_size") === "200" && !query.has("search") && !query.has("ordering"),
      ),
    ).toBe(true);
  });
  const handle = await screen.findByRole("button", { name: "Reordenar: Último Rociado" });
  expect(handle.getAttribute("aria-disabled")).toBe("true");
  expect(screen.queryByText("Rociado 0", { exact: true })).toBeNull();
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
});

test("availability segments request Active, All and Deactivated without sending the UI all sentinel", async () => {
  const rows = catalogRows();
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(CATALOG_ADMIN),
    "GET /api/v1/catalogs/": () => Response.json({ count: 1, results: [CATALOG] }),
    [`GET ${ITEMS_PATH}`]: ({ path }) => {
      const active = new URL(path, "http://api.invalid").searchParams.get("is_active");
      const results =
        active === null ? rows : rows.filter((row) => String(row.is_active) === active);
      return Response.json({ count: results.length, results });
    },
  });
  const app = await renderApp({ path: CATALOG_PATH, fetch: api.fetch });
  const segments = within(await screen.findByRole("group", { name: "Estado" }));
  await screen.findByRole("row", { name: /spraying/ });
  expect(segments.getByRole("button", { name: "Activo" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(screen.queryByRole("row", { name: /Anterior/ })).toBeNull();
  const user = userEvent.setup();
  await user.click(segments.getByRole("button", { name: "Todos" }));
  await screen.findByRole("row", { name: /Anterior/ });
  expect(app.router.state.location.search["is_active"]).toBe("all");
  await user.click(segments.getByRole("button", { name: "Desactivado" }));
  await waitFor(() => {
    expect(screen.queryByRole("row", { name: /spraying/ })).toBeNull();
  });
  expect(segments.getByRole("button", { name: "Desactivado" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(app.router.state.location.search["is_active"]).toBe("false");
  const visible = api.requests
    .filter((entry) => entry.path.startsWith(ITEMS_PATH))
    .map((entry) => new URL(entry.path, "http://api.invalid").searchParams)
    .filter((query) => query.get("page_size") === "25");
  expect(visible.map((query) => query.get("is_active"))).toEqual(["true", null, "false"]);
});

test("catalog navigation owns its server search/order/page without leaking them into the selected editor", async () => {
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(CATALOG_ADMIN),
    "GET /api/v1/catalogs/": ({ path }) => {
      const query = new URL(path, "http://api.invalid").searchParams;
      return Response.json({
        count: query.has("search") ? 0 : 1,
        results: query.has("search") ? [] : [CATALOG],
      });
    },
    [`GET ${ITEMS_PATH}`]: () =>
      Response.json({ count: 1, results: [makeCatalogItem({ is_active: false })] }),
  });
  await renderApp({
    path: `${CATALOG_PATH}?catalog_search=Ausente&catalog_ordering=-label_en&catalog_page=2&is_active=false&search=Rociado&ordering=-code`,
    fetch: api.fetch,
  });
  await screen.findByRole("row", { name: /spraying/ });
  expect(screen.getByRole("heading", { name: "Intervenciones" })).toBeDefined();
  const queries = api.requests.map((entry) => ({
    endpoint: entry.path.split("?")[0],
    query: new URL(entry.path, "http://api.invalid").searchParams,
  }));
  expect(
    queries.some(
      ({ endpoint, query }) =>
        endpoint === "/api/v1/catalogs/" &&
        query.get("search") === "Ausente" &&
        query.get("ordering") === "-label_en" &&
        query.get("page") === "2",
    ),
  ).toBe(true);
  const visible = queries.find(
    ({ endpoint, query }) => endpoint === ITEMS_PATH && query.get("page_size") === "25",
  );
  expect(Object.fromEntries(visible?.query ?? [])).toEqual({
    page: "1",
    page_size: "25",
    search: "Rociado",
    is_active: "false",
    ordering: "-code",
  });
});

test.each([
  { canonicalVersion: 2, visibleVersion: 1, ordering: undefined },
  { canonicalVersion: 1, visibleVersion: 2, ordering: "sort" },
])(
  "a paged drag sends complete ids using both snapshots: canonical $canonicalVersion, visible $visibleVersion",
  async ({ canonicalVersion, visibleVersion, ordering }) => {
    installTableGeometry();
    const canonical = [
      makeCatalogItem(),
      makeCatalogItem({ id: "item-b", code: "b", label_es: "Segundo", sort: 20 }),
      makeCatalogItem({ id: "item-c", code: "c", label_es: "Tercero", sort: 30 }),
    ].map((row) => ({ ...row, catalog_version: canonicalVersion }));
    const api = createFakeApi({
      "GET /api/v1/me/": () => Response.json(CATALOG_ADMIN),
      "GET /api/v1/catalogs/": () =>
        Response.json({ count: 1, results: [{ ...CATALOG, version: 3 }] }),
      [`GET ${ITEMS_PATH}`]: ({ path }) => {
        const full = new URL(path, "http://api.invalid").searchParams.get("page_size") === "200";
        return Response.json({
          count: 27,
          results: full
            ? canonical
            : canonical.slice(1).map((row) => ({ ...row, catalog_version: visibleVersion })),
          next: null,
        });
      },
      [`POST ${ITEMS_PATH}reorder/`]: () => apiError(409, "catalog_version_conflict"),
    });
    const app = await renderApp({
      path: `${CATALOG_PATH}?page=2${ordering ? `&ordering=${ordering}` : ""}`,
      fetch: api.fetch,
    });
    const handle = await screen.findByRole("button", { name: "Reordenar: Tercero" });
    await waitFor(() => {
      expect(handle.getAttribute("aria-disabled")).toBe("false");
    });
    handle.focus();
    const user = userEvent.setup();
    await user.keyboard("[Space]");
    await waitFor(() => {
      expect(handle.getAttribute("aria-pressed")).toBe("true");
    });
    await user.keyboard("[ArrowUp][Space]");
    await screen.findByRole("alert");
    expect(
      api.requests.filter((entry) => entry.method === "POST").map((entry) => entry.body),
    ).toEqual([{ version: 1, ordered_ids: ["item-a", "item-c", "item-b"] }]);
    await waitFor(() => {
      expect(app.queryClient.isFetching()).toBe(0);
    });
    expect(screen.getAllByRole("row")[1]?.textContent).toContain("Segundo");
    expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull();
    const reads = api.requests.filter(
      (entry) => entry.path.startsWith(ITEMS_PATH) && entry.method === "GET",
    );
    expect(
      reads.filter((entry) => entry.path.includes("page_size=200")).length,
    ).toBeGreaterThanOrEqual(2);
    const complete = reads.find((entry) => entry.path.includes("page_size=200"));
    expect(new URL(complete?.path ?? "", "http://api.invalid").searchParams.get("ordering")).toBe(
      ordering ?? null,
    );
    expect(
      reads.filter((entry) => entry.path.includes("page_size=25")).length,
    ).toBeGreaterThanOrEqual(2);
  },
);
