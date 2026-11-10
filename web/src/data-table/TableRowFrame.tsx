import type { MouseEvent, ReactNode } from "react";
import { classNames } from "../styles/class-names";
import { useReorderItems } from "./reorder-context";
import { SortableTableRow } from "./SortableTableRow";
import styles from "./data-table.module.css";
interface Props {
  id: string;
  className?: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLTableRowElement>) => void;
}
export function TableRowFrame({ id, className, children, onClick }: Props) {
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
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- pointer shortcut; the code link is the keyboard path
    <tr className={classNames(className, onClick && styles.clickable)} onClick={onClick}>
      {items && <td className={styles.cell} />}
      {children}
    </tr>
  );
}
