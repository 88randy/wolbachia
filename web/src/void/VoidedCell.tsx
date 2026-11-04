import type { ReactNode } from "react";
import styles from "./voided.module.css";
import { VoidedBadge } from "./VoidedBadge";
import { VoidedText } from "./VoidedText";
import type { VoidInfo } from "./void-info";

interface VoidedCellProps {
  /** `null` (or `undefined`) for a record that is not voided: the children are shown as they are. */
  info: VoidInfo | null | undefined;
  children: ReactNode;
}

/**
 * The cell that identifies a record (its code or title). Voided: struck through, followed by the
 * badge with the reason and author. Not voided: just the children, so a column can use it for
 * every row.
 */
export function VoidedCell({ info, children }: VoidedCellProps) {
  if (info === null || info === undefined) return <>{children}</>;
  return (
    <span className={styles.cell}>
      <VoidedText>{children}</VoidedText>
      <VoidedBadge info={info} />
    </span>
  );
}
