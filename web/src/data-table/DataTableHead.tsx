import { useTranslation } from "react-i18next";
import { RowCheckbox } from "./RowCheckbox";
import { DataTableColumnHead } from "./DataTableColumnHead";
import styles from "./data-table.module.css";
import type { DataTableColumn, TableController } from "./table-types";
export interface SelectAllState {
  label: string;
  isChecked: boolean;
  isMixed: boolean;
  onChange: (isChecked: boolean) => void;
}
interface DataTableHeadProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  controller: TableController;
  selectAll: SelectAllState | undefined;
  hasActions?: boolean;
}
export function DataTableHead<Row>({
  columns,
  controller,
  selectAll,
  hasActions,
}: DataTableHeadProps<Row>) {
  const { t } = useTranslation();
  return (
    <thead>
      <tr>
        {selectAll && (
          <th scope="col" className={styles.head}>
            <RowCheckbox {...selectAll} />
          </th>
        )}
        {columns.map((column) => (
          <DataTableColumnHead key={column.id} column={column} controller={controller} />
        ))}
        {hasActions && (
          <th scope="col" className={styles.head}>
            {t("refresh.table.actions")}
          </th>
        )}
      </tr>
    </thead>
  );
}
