import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import { RowCheckbox } from "./RowCheckbox";
import { SortButton } from "./SortButton";
import styles from "./data-table.module.css";
import type { DataTableColumn, SortDirection, TableController } from "./table-types";

const ARIA_SORT = { asc: "ascending", desc: "descending", none: "none" } as const;

/** State of the "select all rows of this page" box. */
export interface SelectAllState {
  label: string;
  isChecked: boolean;
  isMixed: boolean;
  onChange: (isChecked: boolean) => void;
}

interface HeadCellProps<Row> {
  column: DataTableColumn<Row>;
  controller: TableController;
}

function HeadCell<Row>({ column, controller }: HeadCellProps<Row>) {
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

interface DataTableHeadProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  controller: TableController;
  selectAll: SelectAllState | undefined;
}

export function DataTableHead<Row>({ columns, controller, selectAll }: DataTableHeadProps<Row>) {
  return (
    <thead>
      <tr>
        {selectAll !== undefined && (
          <th scope="col" className={classNames(styles.head, styles.selectCell)}>
            <RowCheckbox
              label={selectAll.label}
              isChecked={selectAll.isChecked}
              isMixed={selectAll.isMixed}
              onChange={selectAll.onChange}
            />
          </th>
        )}
        {columns.map((column) => (
          <HeadCell key={column.id} column={column} controller={controller} />
        ))}
      </tr>
    </thead>
  );
}
