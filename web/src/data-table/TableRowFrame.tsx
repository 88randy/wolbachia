import type { ReactNode } from "react";
import { useReorderItems } from "./reorder-context";
import { SortableTableRow } from "./SortableTableRow";
import styles from "./data-table.module.css";
interface Props {
  id: string;
  className?: string;
  children: ReactNode;
}
export function TableRowFrame({ id, className, children }: Props) {
  const items = useReorderItems();
  const index = items?.filter((item) => !item.isDisabled).findIndex((item) => item.id === id) ?? -1;
  const item = items?.find((entry) => entry.id === id);
  if (item && index >= 0)
    return (
      <SortableTableRow
        id={id}
        index={index}
        label={item.label}
        isBusy={item.isBusy}
        className={className}
      >
        {children}
      </SortableTableRow>
    );
  return (
    <tr className={className}>
      {items && <td className={styles.cell} />}
      {children}
    </tr>
  );
}
