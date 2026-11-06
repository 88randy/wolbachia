import type { ReactNode } from "react";
import styles from "./data-table.module.css";
export function RowActionCell({ children }: { children: ReactNode }) {
  return (
    <td className={styles.cell}>
      <div className={styles.rowActions}>{children}</div>
    </td>
  );
}
