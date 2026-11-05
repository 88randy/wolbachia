import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import { SortButton } from "./SortButton";
import styles from "./data-table.module.css";
import type { DataTableColumn, SortDirection, TableController } from "./table-types";
const ARIA_SORT = { asc: "ascending", desc: "descending", none: "none" } as const;
interface ColumnHeadProps<Row> {
  column: DataTableColumn<Row>;
  controller: TableController;
}
export function DataTableColumnHead<Row>(props: ColumnHeadProps<Row>) {
  const { column, controller } = props;
  const { t } = useTranslation();
  const label = t(column.headerKey);
  const isSortable = controller.config.sortableIds.includes(column.id);
  const { sort } = controller.state;
  const direction: SortDirection | null = sort?.id === column.id ? sort.direction : null;
  return (
    <th
      scope="col"
      className={classNames(styles.head, column.align === "end" && styles.end)}
      aria-sort={isSortable ? ARIA_SORT[direction ?? "none"] : undefined}
    >
      {isSortable ? (
        <SortButton
          label={label}
          direction={direction}
          onToggle={() => {
            controller.toggleSort(column.id);
          }}
        />
      ) : (
        <span className={styles.headLabel}>{label}</span>
      )}
    </th>
  );
}
