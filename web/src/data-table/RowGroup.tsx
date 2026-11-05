import type { ReactNode } from "react";
import styles from "./data-table.module.css";
export function RowGroup({
  label,
  columns,
  children,
}: {
  label?: string;
  columns: number;
  children: ReactNode;
}) {
  return (
    <>
      {label !== undefined && (
        <tr className={styles.groupRow}>
          <th scope="rowgroup" colSpan={columns}>
            {label}
          </th>
        </tr>
      )}
      {children}
    </>
  );
}
