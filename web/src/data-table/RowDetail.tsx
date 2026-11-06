import type { ReactNode } from "react";
import styles from "./data-table.module.css";
export function RowDetail({
  id,
  expanded,
  columns,
  children,
}: {
  id: string;
  expanded: boolean;
  columns: number;
  children: ReactNode;
}) {
  return (
    <tr id={id} hidden={!expanded}>
      <td className={styles.detailCell} colSpan={columns}>
        {expanded && children}
      </td>
    </tr>
  );
}
