import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import styles from "./data-table.module.css";
interface Props {
  id: string;
  index: number;
  label: string;
  className?: string;
  isBusy?: boolean;
  children: ReactNode;
}
/** The visible handle is the only activator, so clicking a cell keeps its normal behavior. */
export function SortableTableRow({ id, index, label, className, isBusy, children }: Props) {
  const { t } = useTranslation();
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
    transition: null,
    disabled: isBusy ?? false,
  });
  return (
    <tr ref={ref} className={className} data-row-dragging={isDragging || undefined}>
      <td className={styles.cell}>
        <button
          ref={handleRef}
          type="button"
          className={styles.grip}
          aria-roledescription={t("refresh.reorder.handle")}
          aria-disabled={isBusy}
          aria-label={`${t("refresh.reorder.handle")}: ${label}`}
        >
          <GripVertical aria-hidden="true" />
        </button>
      </td>
      {children}
    </tr>
  );
}
