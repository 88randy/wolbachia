import { InfoHint } from "../ui/InfoHint";
import { useTranslation } from "react-i18next";
import type { TableData } from "../data-table/table-types";
import type { Catalog, CatalogItem } from "./catalogs-query";
import { CatalogEditorContext } from "./catalog-editor-context";
import { useCatalogEditor } from "./use-catalog-editor";
import { CatalogEditorControls } from "./CatalogEditorControls";
import { CatalogTable } from "./CatalogTable";
import styles from "./catalogs.module.css";
import type { useCatalogTable } from "./use-catalog-table";
import { displayLabel } from "./catalog-domain";
interface Props {
  catalog: Catalog;
  items: TableData<CatalogItem>;
  canonicalRows: readonly CatalogItem[];
  table: ReturnType<typeof useCatalogTable>;
  isReady: boolean;
}
/** A draft/write guard belongs to one identity and catalog while its query observer stays mounted. */
export function CatalogEditor({ catalog, items, canonicalRows, table, isReady }: Props) {
  const { t } = useTranslation();
  const editor = useCatalogEditor(catalog.slug, canonicalRows, {
    isReady,
    canReorder: table.canReorder,
    viewKey: table.viewKey,
    displayedVersion: Math.min(
      ...canonicalRows.map((item) => item.catalog_version),
      ...items.rows.map((item) => item.catalog_version),
    ),
  });
  return (
    <CatalogEditorContext value={editor}>
      <div className={styles.content}>
        <h2 className="flex items-center gap-2">
          {displayLabel(catalog, editor.language).label}
          <InfoHint text={t(catalog.is_open ? "catalogs.page.open" : "catalogs.page.closed")} />
        </h2>
        <CatalogEditorControls editor={editor} isReady={isReady} />
        <CatalogTable items={items} table={table} />
      </div>
    </CatalogEditorContext>
  );
}
