import type { Catalog, CatalogItem } from "../catalogs/catalogs-query";
import { makeMe } from "./fake-api";
export const CATALOG_ADMIN = makeMe({
  permissions: [
    "catalog.read",
    "catalog_item.create",
    "catalog_item.update",
    "catalog_item.deactivate",
    "catalog_item.activate",
  ],
});
export const CATALOG: Catalog = {
  slug: "intervention-type",
  label_es: "Intervenciones",
  label_en: "Interventions",
  is_open: true,
  version: 0,
};
export const CATALOG_PATH = "/settings/catalogs/intervention-type";
export const ITEMS_PATH = "/api/v1/catalogs/intervention-type/items/";
/** Synthetic configuration only; no real people or organization records. */
export function makeCatalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: "item-a",
    code: "spraying",
    label_es: "Rociado",
    label_en: "Spraying",
    sort: 10,
    is_active: true,
    is_other: false,
    protected: false,
    in_use: false,
    usage_count: 0,
    created_by: null,
    created_by_username: null,
    deactivated_at: null,
    deactivated_by: null,
    deactivated_by_username: null,
    icon: "",
    requires_photo: false,
    created_at: "2026-01-01T05:00:00Z",
    updated_at: "2026-01-01T05:00:00Z",
    ...overrides,
  };
}
export function catalogRows(): CatalogItem[] {
  return [
    makeCatalogItem(),
    makeCatalogItem({
      id: "item-b",
      code: "fogging",
      label_es: "Nebulización",
      label_en: "Fogging",
      sort: 20,
    }),
    makeCatalogItem({
      id: "item-old",
      code: "old",
      label_es: "Anterior",
      label_en: "Previous",
      sort: 30,
      is_active: false,
    }),
    makeCatalogItem({
      id: "item-other",
      code: "other",
      label_es: "Otro (especificar)",
      label_en: "Other (specify)",
      sort: 0,
      is_other: true,
      protected: true,
    }),
  ];
}
