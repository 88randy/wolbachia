import { useTranslation } from "react-i18next";
import { PreviewMetrics } from "./PreviewMetrics";
import { PreviewTrend } from "./PreviewTrend";
import { PreviewTable } from "./PreviewTable";
import { PreviewWidgets } from "./PreviewWidgets";
import styles from "./PreviewDashboard.module.css";
/** Approval-only domain demo. The shell and each displayed primitive are the real shared code. */
export function PreviewDashboard() {
  const { t } = useTranslation();
  return (
    <section className={styles.dashboard} aria-labelledby="preview-dashboard-title">
      <header className={styles.heading}>
        <div>
          <h1 id="preview-dashboard-title">{t("refresh.preview.title")}</h1>
          <p>{t("refresh.preview.subtitle")}</p>
        </div>
        <span className={styles.demo}>{t("refresh.preview.demo")}</span>
      </header>
      <div className={styles.columns}>
        <div className={styles.main}>
          <PreviewMetrics />
          <PreviewTrend />
          <PreviewTable />
        </div>
        <PreviewWidgets />
      </div>
      <p className={styles.source}>{t("refresh.preview.source")}</p>
    </section>
  );
}
