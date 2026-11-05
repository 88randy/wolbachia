import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import styles from "./analytics.module.css";
interface KpiStripProps {
  children: ReactNode;
  label?: string;
}
/** One shared surface with equal, gently divided metric cells. */
export function KpiStrip({ children, label }: KpiStripProps) {
  const { t } = useTranslation();
  return (
    <section className={styles.kpiStrip} aria-label={label ?? t("analytics.kpi.label")}>
      {children}
    </section>
  );
}
