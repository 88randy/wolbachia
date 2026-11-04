import type { Row, RowData } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { RowCheckbox } from "./RowCheckbox";
import styles from "./data-table.module.css";
import type { DataTableFeatures } from "./use-data-table";

interface RowSelectCellProps<TRow extends RowData> {
  row: Row<DataTableFeatures, TRow>;
  /** What names the row for a screen reader: its code or name. */
  label: string;
}

export function RowSelectCell<TRow extends RowData>({ row, label }: RowSelectCellProps<TRow>) {
  const { t } = useTranslation();
  return (
    <td className={styles.selectCell}>
      <RowCheckbox
        label={t("table.selection.row", { row: label })}
        isChecked={row.getIsSelected()}
        isDisabled={!row.getCanSelect()}
        onChange={(isChecked) => {
          row.toggleSelected(isChecked);
        }}
      />
    </td>
  );
}
