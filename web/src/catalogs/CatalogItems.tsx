import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { CatalogEditorContext } from "./catalog-editor-context";
import { catalogItemsQueryOptions } from "./catalogs-query";
import type { Catalog } from "./catalogs-query";
import { useCatalogEditor } from "./use-catalog-editor";
import { CatalogEditorControls } from "./CatalogEditorControls";
import { CatalogTable } from "./CatalogTable";
import styles from "./catalogs.module.css";
/** Fetch every page and keep the editor, dialogs and table scoped to this session identity and slug. */
export function CatalogItems({ catalog }: { catalog: Catalog }) {
  const { t } = useTranslation();
  const scope = { client: useApiClient(), identity: useSessionIdentity() };
  const query = useQuery(catalogItemsQueryOptions(scope, catalog.slug));
  const editor = useCatalogEditor(catalog.slug, query.data ?? []);
  const tableItems = {
    rows: query.data ?? [],
    paging: undefined,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
  return (
    <CatalogEditorContext value={editor}>
      <div className={styles.content}>
        <CatalogEditorControls
          editor={editor}
          isReady={query.data !== undefined && query.error === null}
        />
        <p className={styles.note}>
          {t(catalog.is_open ? "catalogs.page.open" : "catalogs.page.closed")}
        </p>
        <CatalogTable items={tableItems} />
      </div>
    </CatalogEditorContext>
  );
}
