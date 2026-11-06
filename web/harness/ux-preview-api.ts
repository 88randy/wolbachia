import type { Schemas } from "@wolbachia/api-client";
import { apiError, createFakeApi, makeMe, noContent } from "../src/test/fake-api";
import type { RecordedRequest } from "../src/test/fake-api";
import { CATALOG, CATALOG_ADMIN, catalogRows, makeCatalogItem } from "../src/test/catalog-fixtures";
import { catalogItemFixturePage } from "../src/test/catalog-list-fixture";
const ITEMS = `/api/v1/catalogs/${CATALOG.slug}/items/`;
const pageOf = (results: readonly unknown[]) =>
  Response.json({ count: results.length, next: null, previous: null, results });
/** Fixtures never contact a server or use stored credentials, organization data or personal records. */
export function createUxPreviewApi() {
  let rows = catalogRows();
  let version = 0;
  const fake = createFakeApi({
    "GET /api/v1/me/": Response.json(
      makeMe({
        ...CATALOG_ADMIN,
        permissions: [
          ...CATALOG_ADMIN.permissions,
          "device.read",
          "rule_parameter.read",
          "motorcycle.read",
          "role.read",
          "organization.read",
        ],
      }),
    ),
    "POST /api/v1/auth/logout/": noContent(),
    "GET /api/v1/catalogs/": () => pageOf([{ ...CATALOG, version }]),
    [`GET ${ITEMS}`]: ({ path }) =>
      Response.json(
        catalogItemFixturePage(
          rows.map((item) => ({ ...item, catalog_version: version })),
          path,
        ),
      ),
    [`POST ${ITEMS}reorder/`]: (request) => {
      const body = request.body as Schemas["CatalogReorderRequest"];
      if (body.version !== version) return apiError(409, "catalog_version_conflict");
      version += 1;
      rows = body.ordered_ids
        .flatMap((id) => {
          const item = rows.find((entry) => entry.id === id);
          return item ? [item] : [];
        })
        .concat(rows.filter((item) => !body.ordered_ids.includes(item.id)));
      return Response.json({ version, items: rows });
    },
  });
  const create = (request: RecordedRequest) => {
    const body = request.body as Schemas["CatalogItemCreateRequest"];
    const item = makeCatalogItem({ ...body, id: crypto.randomUUID() });
    rows = [...rows, item];
    version += 1;
    register(item.id);
    return Response.json(item);
  };
  const register = (id: string) => {
    fake.setRoute(`PATCH ${ITEMS}${id}/`, (request) => {
      const body = request.body as Schemas["PatchedCatalogItemUpdateRequest"];
      rows = rows.map((item) => (item.id === id ? { ...item, ...body } : item));
      version += 1;
      return Response.json(rows.find((item) => item.id === id));
    });
    for (const action of ["activate", "deactivate"])
      fake.setRoute(`POST ${ITEMS}${id}/${action}/`, () => {
        rows = rows.map((item) =>
          item.id === id ? { ...item, is_active: action === "activate" } : item,
        );
        version += 1;
        return Response.json(rows.find((item) => item.id === id));
      });
  };
  rows.forEach((item) => {
    register(item.id);
  });
  fake.setRoute(`POST ${ITEMS}`, create);
  return fake;
}
