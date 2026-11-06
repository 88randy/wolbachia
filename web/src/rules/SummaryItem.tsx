import type { ReactNode } from "react";
import styles from "./rules.module.css";
export function SummaryItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className={styles.summaryItem}>
      <dt className={styles.term}>{term}</dt>
      <dd className={styles.detail}>{children}</dd>
    </div>
  );
}
