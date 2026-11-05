import { nextItemSort } from "./catalog-domain";
import { useApiClient } from "../api/ApiClientProvider";
import type { CatalogItem } from "./catalogs-query";
import type { CatalogValues } from "./catalog-schema";
import type { useCatalogWrite } from "./use-catalog-write";
/** Create sends code, labels and active-item sort; edit sends only labels, leaving immutable/default fields alone. */
export function useCatalogSave(
  slug: string,
  write: ReturnType<typeof useCatalogWrite>,
  items: readonly CatalogItem[],
) {
  const client = useApiClient();
  return (values: CatalogValues, item?: CatalogItem) =>
    write.run((guard) =>
      write.send(
        () =>
          item
            ? client.PATCH("/api/v1/catalogs/{catalog_slug}/items/{id}/", {
                params: { path: { catalog_slug: slug, id: item.id } },
                body: { label_es: values.label_es, label_en: values.label_en },
                signal: guard.signal,
              })
            : client.POST("/api/v1/catalogs/{catalog_slug}/items/", {
                params: { path: { catalog_slug: slug } },
                body: { ...values, sort: nextItemSort(items) },
                signal: guard.signal,
              }),
        guard,
      ),
    );
}
