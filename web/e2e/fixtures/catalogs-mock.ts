import type { Page, Route } from "@playwright/test";
import type { CatalogItem } from "../../src/catalogs/catalogs-query";
import { CATALOG, catalogRows, makeCatalogItem } from "../../src/test/catalog-fixtures";

interface WriteBody {
  code?: string;
  label_es?: string;
  label_en?: string;
  sort?: number;
}
const json = (route: Route, body: unknown) => route.fulfill({ json: body });

/** Stateful API fixtures: the journey sees its writes after each query invalidation. */
export async function mockCatalogs(page: Page) {
  let items = catalogRows();
  await page.route("**/api/v1/catalogs/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/catalogs/") return json(route, pageOf([CATALOG]));
    if (request.method() === "GET") return json(route, pageOf(ordered(items)));
    const body = (request.postData() ? request.postDataJSON() : {}) as WriteBody;
    if (path.endsWith("/items/")) {
      const created = makeCatalogItem({
        id: crypto.randomUUID(),
        code: body.code ?? "",
        label_es: body.label_es ?? "",
        label_en: body.label_en ?? "",
        sort: 40,
      });
      items = [...items, created];
      return json(route, created);
    }
    items = items.map((item) => updateItem(item, path, body));
    return json(
      route,
      items.find((item) => path.includes(item.id)),
    );
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
