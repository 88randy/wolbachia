import type { ReactNode } from "react";
import { KpiDelta } from "./KpiDelta";
import styles from "./analytics.module.css";
interface KpiCellProps {
  label: string;
  value: ReactNode;
  href?: string;
  delta: number;
  deltaUnit?: string;
}
/** Display-ready values link to their records; deltas retain their signed comparison. */
export function KpiCell({ label, value, href, delta, deltaUnit = "%" }: KpiCellProps) {
  return (
    <div className={styles.kpiCell}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiFigure}>
        {href ? (
          <a className={styles.kpiValue} href={href}>
            {value}
          </a>
        ) : (
          <span className={styles.kpiValue}>{value}</span>
        )}
        <KpiDelta delta={delta} unit={deltaUnit} />
      </div>
    </div>
  );
}
