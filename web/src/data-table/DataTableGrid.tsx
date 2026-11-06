/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", {"roles": ["region"]}] -- Named scroll regions must be keyboard-scrollable (WCAG 2.1.1). */
import type { ReactTable, RowData } from "@tanstack/react-table";
import utilities from "../styles/utilities.module.css";
import { DataTableHead } from "./DataTableHead";
import { DataTableBody } from "./DataTableBody";
import styles from "./data-table.module.css";
import type {
  DataTableColumn,
  RowSelectionConfig,
  TableController,
  TablePresentation,
  VoidInfo,
} from "./table-types";
import type { DataTableFeatures } from "./use-data-table";
import { useSelectAll } from "./use-select-all";
interface DataTableGridProps<TRow extends RowData> extends TablePresentation<TRow> {
  caption: string;
  table: ReactTable<DataTableFeatures, TRow>;
  columns: readonly DataTableColumn<TRow>[];
  controller: TableController;
  voidOf: ((row: TRow) => VoidInfo | null) | undefined;
  selection: RowSelectionConfig<TRow> | undefined;
}
export function DataTableGrid<TRow extends RowData>(props: DataTableGridProps<TRow>) {
  const { caption, table, columns, controller, selection } = props;
  const selectAll = useSelectAll(table);
  return (
    <div className={styles.scroll} role="region" tabIndex={0} aria-label={caption}>
      <table className={styles.table}>
        <caption className={utilities.srOnly}>{caption}</caption>
        <DataTableHead
          columns={columns}
          controller={controller}
          selectAll={selection === undefined ? undefined : selectAll}
          hasActions={props.rowActions !== undefined}
        />
        <DataTableBody {...props} />
      </table>
    </div>
  );
}
