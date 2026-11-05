import { useMemo } from "react";
import type { DataTableColumn } from "../data-table/table-types";
import { useFormatDate } from "../format/use-formatters";
import type { CatalogItem } from "./catalogs-query";
import { CatalogActions } from "./CatalogActions";
import { CatalogLabel } from "./CatalogLabel";
import { CatalogStatus } from "./CatalogStatus";
import styles from "./catalogs.module.css";
type Column = DataTableColumn<CatalogItem>;
const IDENTITY_COLUMNS: Column[] = [
  { id: "item", headerKey: "catalogs.table.item", cell: (item) => <CatalogLabel item={item} /> },
  {
    id: "code",
    headerKey: "catalogs.table.code",
    cell: (item) => (
      <span className={item.is_active ? styles.code : styles.struck}>{item.code}</span>
    ),
  },
];
const ACTION_COLUMNS: Column[] = [
  {
    id: "status",
    headerKey: "catalogs.table.status",
    cell: (item) => <CatalogStatus item={item} />,
  },
  {
    id: "actions",
    headerKey: "catalogs.table.actions",
    cell: (item) => <CatalogActions item={item} />,
  },
];
/** Stable cell renderers preserve keyboard focus across dialog and mutation state changes. */
export function useCatalogColumns(): Column[] {
  const formatDate = useFormatDate();
  return useMemo(
    () => [
      ...IDENTITY_COLUMNS,
      {
        id: "created",
        headerKey: "catalogs.table.created",
        cell: (item) => (
          <span className={item.is_active ? undefined : styles.struck}>
            {formatDate(item.created_at)}
          </span>
        ),
      },
      ...ACTION_COLUMNS,
    ],
    [formatDate],
  );
}
