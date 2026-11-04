import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { classNames } from "../styles/class-names";
import styles from "./data-table.module.css";
import type { SortDirection } from "./table-types";

const ICONS: Record<SortDirection | "none", LucideIcon> = {
  asc: ArrowUp,
  desc: ArrowDown,
  none: ArrowUpDown,
};

interface SortButtonProps {
  label: string;
  /** `null`: the table is not sorted by this column. */
  direction: SortDirection | null;
  onToggle: () => void;
}

/**
 * Header of a sortable column: a real button (Enter and Space work, it is in the tab order). The
 * state is read from `aria-sort` on its `<th>` and from the live region of the table, and the
 * arrow is a second cue next to the color, never the only one.
 */
export function SortButton({ label, direction, onToggle }: SortButtonProps) {
  const Icon = ICONS[direction ?? "none"];
  return (
    <button
      type="button"
      className={classNames(styles.sortButton, direction !== null && styles.sorted)}
      onClick={onToggle}
    >
      {label}
      <Icon className={styles.sortIcon} aria-hidden="true" />
    </button>
  );
}
