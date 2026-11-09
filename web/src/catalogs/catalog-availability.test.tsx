import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { apiError, createFakeApi } from "../test/fake-api";
import {
  CATALOG,
  CATALOG_ADMIN,
  CATALOG_PATH,
  ITEMS_PATH,
  makeCatalogItem,
} from "../test/catalog-fixtures";
import { renderApp } from "../test/render-app";
import { pageOf } from "../test/rules-fixtures";
import { bumpEpoch } from "../session/session-revision";
import type { FakeApiRoutes } from "../test/fake-api";
import type { CatalogItem } from "./catalogs-query";

function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function open(read: () => CatalogItem, routes: FakeApiRoutes) {
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(CATALOG_ADMIN),
    "GET /api/v1/catalogs/": () => pageOf([CATALOG]),
    [`GET ${ITEMS_PATH}`]: () => pageOf([read()]),
    ...routes,
  });
  const app = await renderApp({ path: `${CATALOG_PATH}?is_active=all`, fetch: api.fetch });
  await screen.findByRole("row", { name: /spraying/ });
  return { ...api, app };
}
async function deactivate() {
  await userEvent.click(
    within(screen.getByRole("row", { name: /spraying/ })).getByRole("button", {
      name: "Desactivar",
    }),
  );
}

test("availability Undo retains our exact response revision through a newer read and two-editor ABA", async () => {
  let current = makeCatalogItem({ catalog_version: 10 });
  const reply = deferred();
  const api = await open(() => current, {
    [`POST ${ITEMS_PATH}item-a/deactivate/`]: () => reply.promise,
    [`POST ${ITEMS_PATH}item-a/activate/`]: () => apiError(409, "catalog_version_conflict"),
  });
  await deactivate();
  await waitFor(() => {
    expect(api.requests.filter((r) => r.method === "POST")).toHaveLength(1);
  });
  expect(api.requests.find((r) => r.method === "POST")?.body).toEqual({ version: 10 });
  await act(async () => {
    current = makeCatalogItem({
      is_active: false,
      catalog_version: 13,
      label_es: "Later editor state",
    });
    reply.resolve(Response.json(makeCatalogItem({ is_active: false, catalog_version: 11 })));
    await reply.promise;
  });
  await screen.findByText("Later editor state");
  await userEvent.click(await screen.findByRole("button", { name: "Deshacer" }));
  await screen.findByRole("alert");
  expect(api.requests.filter((r) => r.method === "POST").map((r) => r.body)).toEqual([
    { version: 10 },
    { version: 11 },
  ]);
  expect(current.catalog_version).toBe(13);
  expect(
    within(screen.getByRole("row", { name: /spraying/ })).getByText("Desactivado"),
  ).toBeDefined();
});

test("a stale initial availability intent refreshes current rows without an Undo receipt", async () => {
  let current = makeCatalogItem({ catalog_version: 10 });
  const api = await open(() => current, {
    [`POST ${ITEMS_PATH}item-a/deactivate/`]: () => {
      current = makeCatalogItem({
        is_active: false,
        catalog_version: 12,
        label_es: "Current committed row",
      });
      return apiError(409, "catalog_version_conflict");
    },
  });
  await deactivate();
  await screen.findByText("Current committed row");
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull();
  expect(api.requests.filter((r) => r.method === "POST").map((r) => r.body)).toEqual([
    { version: 10 },
  ]);
});

test.each(["lost", "invalid"])(
  "%s availability receipt remains uncertain and explicit review never replays it",
  async (kind) => {
    let current = makeCatalogItem({ catalog_version: 10 });
    const api = await open(() => current, {
      [`POST ${ITEMS_PATH}item-a/deactivate/`]: () => {
        current = makeCatalogItem({ is_active: false, catalog_version: 11 });
        if (kind === "lost") throw new Error("Simulated lost committed availability response");
        return Response.json({ ...current, catalog_version: null });
      },
    });
    await deactivate();
    const review = await screen.findByRole("button", { name: "Revisar estado actual" });
    expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull();
    await waitFor(() => {
      expect(review.hasAttribute("disabled")).toBe(false);
    });
    await userEvent.click(review);
    await waitFor(() => {
      expect(
        api.requests.filter((r) => r.method === "GET" && r.path.startsWith(ITEMS_PATH)).length,
      ).toBeGreaterThan(2);
    });
    expect(api.requests.filter((r) => r.method === "POST")).toHaveLength(1);
  },
);

test.each(["session", "view"])(
  "a held availability response after the originating %s ends cannot offer Undo or refetch",
  async (boundary) => {
    const reply = deferred();
    const api = await open(() => makeCatalogItem({ catalog_version: 10 }), {
      [`POST ${ITEMS_PATH}item-a/deactivate/`]: () => reply.promise,
    });
    await deactivate();
    await waitFor(() => {
      expect(api.requests.filter((r) => r.method === "POST")).toHaveLength(1);
    });
    const reads = api.requests.filter((r) => r.method === "GET").length;
    if (boundary === "session") {
      act(() => {
        bumpEpoch();
      });
    } else {
      await act(async () => {
        await api.app.router.navigate({
          to: "/settings/catalogs/$slug",
          params: { slug: CATALOG.slug },
          search: { is_active: "all", search: "fenced" },
        });
      });
      await waitFor(() => {
        expect(api.app.queryClient.isFetching()).toBe(0);
      });
      await act(async () => {
        await api.app.router.navigate({
          to: "/settings/catalogs/$slug",
          params: { slug: CATALOG.slug },
          search: { is_active: "all" },
        });
      });
      await waitFor(() => {
        expect(api.app.queryClient.isFetching()).toBe(0);
      });
      expect(
        within(screen.getByRole("row", { name: /spraying/ })).getByText("Activo"),
      ).toBeDefined();
    }
    await waitFor(() => {
      expect(api.requests.filter((r) => r.method === "GET").length).toBeGreaterThan(reads);
    });
    await waitFor(() => {
      expect(api.app.queryClient.isFetching()).toBe(0);
    });
    const currentReads = api.requests.filter((r) => r.method === "GET").length;
    await act(async () => {
      reply.resolve(Response.json(makeCatalogItem({ is_active: false, catalog_version: 11 })));
      await reply.promise;
    });
    expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull();
    expect(api.requests.filter((r) => r.method === "GET")).toHaveLength(currentReads);
  },
);

test("a later explicit availability attempt retires an earlier Undo even when it fails", async () => {
  let current = makeCatalogItem({ catalog_version: 10 });
  const api = await open(() => current, {
    [`POST ${ITEMS_PATH}item-a/deactivate/`]: () => {
      current = makeCatalogItem({ is_active: false, catalog_version: 11 });
      return Response.json(current);
    },
    [`POST ${ITEMS_PATH}item-a/activate/`]: () => apiError(400, "validation_error"),
  });
  await deactivate();
  await screen.findByRole("button", { name: "Deshacer" });
  await userEvent.click(
    within(screen.getByRole("row", { name: /spraying/ })).getByRole("button", {
      name: "Reactivar",
    }),
  );
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  expect(api.requests.filter((r) => r.method === "POST").map((r) => r.body)).toEqual([
    { version: 10 },
    { version: 11 },
  ]);
});
