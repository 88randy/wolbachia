import type { ReactTable, RowData } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import type { SelectAllState } from "./DataTableHead";
import type { DataTableFeatures } from "./use-data-table";

/** State of the header checkbox that selects every selectable row of the page. */
export function useSelectAll<TRow extends RowData>(
  table: ReactTable<DataTableFeatures, TRow>,
): SelectAllState {
  const { t } = useTranslation();
  const isAll = table.getIsAllPageRowsSelected();
  return {
    label: t("table.selection.all"),
    isChecked: isAll,
    isMixed: table.getIsSomePageRowsSelected() && !isAll,
    onChange: (isChecked) => {
      table.toggleAllPageRowsSelected(isChecked);
    },
  };
}
