import { Pager } from "./Pager";
import { TableStatus } from "./TableStatus";
import type { TableController, TableData } from "./table-types";
import styles from "./data-table.module.css";
interface TableFooterProps {
  data: Pick<TableData<unknown>, "paging" | "rows" | "isFetching">;
  controller: TableController;
  sortText: string | null;
}
export function TableFooter({ data, controller, sortText }: TableFooterProps) {
  return (
    <div className={styles.footer}>
      <TableStatus
        paging={data.paging}
        rowCount={data.rows.length}
        isFetching={data.isFetching}
        sortText={sortText}
      />
      {data.paging !== undefined && <Pager paging={data.paging} controller={controller} />}
    </div>
  );
}
