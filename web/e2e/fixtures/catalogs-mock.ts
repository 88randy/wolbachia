import type { Page, Route } from "@playwright/test";
import type { CatalogItem } from "../../src/catalogs/catalogs-query";
import { CATALOG, catalogRows, makeCatalogItem } from "../../src/test/catalog-fixtures";
import { catalogItemFixturePage } from "../../src/test/catalog-list-fixture";

interface WriteBody {
  code?: string;
  label_es?: string;
  label_en?: string;
  sort?: number;
  version?: number;
  ordered_ids?: string[];
}
const json = (route: Route, body: unknown) => route.fulfill({ json: body });

interface CatalogState {
  items: CatalogItem[];
  version: number;
}

/** Stateful API fixtures: the journey sees its writes after each query invalidation. */
export async function mockCatalogs(page: Page) {
  let state: CatalogState = { items: catalogRows(), version: CATALOG.version };
  await page.route("**/api/v1/catalogs/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/catalogs/")
      return json(route, pageOf([{ ...CATALOG, version: state.version }]));
    if (request.method() === "GET")
      return json(route, catalogItemFixturePage(readItems(state), request.url()));
    const body = (request.postData() ? request.postDataJSON() : {}) as WriteBody;
    if (
      ["/reorder/", "/activate/", "/deactivate/"].some((action) => path.endsWith(action)) &&
      body.version !== state.version
    )
      return route.fulfill({
        status: 409,
        json: { code: "catalog_version_conflict", detail: "Catalog changed." },
      });
    const write = applyWrite(state, path, body);
    state = write.state;
    return json(route, write.answer);
  });
}

function applyWrite(state: CatalogState, path: string, body: WriteBody) {
  const version = state.version + 1;
  if (path.endsWith("/reorder/")) {
    const items = withCatalogVersion(reorderItems(state.items, body.ordered_ids ?? []), version);
    return { state: { items, version }, answer: { version, items: ordered(items) } };
  }
  const created = path.endsWith("/items/") ? createItem(body) : undefined;
  const items = withCatalogVersion(
    created ? [...state.items, created] : state.items.map((item) => updateItem(item, path, body)),
    version,
  );
  return {
    state: { items, version },
    answer: items.find((item) => (created ? item.id === created.id : path.includes(item.id))),
  };
}

function reorderItems(items: CatalogItem[], ids: string[]) {
  return items.map((item) => {
    const position = ids.indexOf(item.id);
    return position < 0 ? item : { ...item, sort: (position + 1) * 10 };
  });
}

function createItem(body: WriteBody) {
  return makeCatalogItem({
    id: crypto.randomUUID(),
    code: body.code ?? "",
    label_es: body.label_es ?? "",
    label_en: body.label_en ?? "",
    sort: 40,
  });
}

function pageOf(results: readonly unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}
function ordered(items: CatalogItem[]) {
  return [...items].sort(
    (first, second) =>
      Number(first.is_other) - Number(second.is_other) ||
      first.sort - second.sort ||
      first.code.localeCompare(second.code),
  );
}
function updateItem(item: CatalogItem, path: string, body: WriteBody): CatalogItem {
  if (!path.includes(`/${item.id}/`)) return item;
  if (path.endsWith("/deactivate/")) return { ...item, is_active: false };
  if (path.endsWith("/activate/")) return { ...item, is_active: true };
  return { ...item, ...body };
}

function readItems(state: CatalogState) {
  return ordered(withCatalogVersion(state.items, state.version));
}

function withCatalogVersion(items: CatalogItem[], version: number): CatalogItem[] {
  return items.map((item) => ({ ...item, catalog_version: version }));
}
