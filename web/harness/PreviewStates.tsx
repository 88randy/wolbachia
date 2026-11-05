import { useTranslation } from "react-i18next";
import { Card } from "../src/ui/Card";
import { TableSkeleton } from "../src/ui/TableSkeleton";
import { KpiSkeleton } from "../src/ui/KpiSkeleton";
import { CardSkeleton } from "../src/ui/CardSkeleton";
import { EmptyState } from "../src/ui/EmptyState";
import { ErrorState } from "../src/ui/ErrorState";
import { Refreshing } from "../src/ui/Refreshing";
import { useToast } from "../src/ui/ToastProvider";
import { PreviewUndo } from "./PreviewUndo";
import styles from "./PreviewComponents.module.css";
export function PreviewStates() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const retry = () => {
    showToast({ message: t("refresh.preview.retryDone"), tone: "success" });
  };
  return (
    <section className={styles.stack} aria-labelledby="preview-states-title">
      <h3 id="preview-states-title" className={styles.sectionTitle}>
        {t("refresh.preview.states")}
      </h3>
      <div className={styles.grid}>
        <Card title={t("refresh.preview.skeleton")}>
          <div className={styles.stack}>
            <KpiSkeleton cells={2} />
            <TableSkeleton rows={3} columns={3} />
            <CardSkeleton />
          </div>
        </Card>
        <div className={styles.stack}>
          <Card title={t("refresh.preview.empty")}>
            <EmptyState kind="noData" actionLabel={t("refresh.preview.create")} onAction={retry} />
          </Card>
          <Card title={t("refresh.preview.noResults")}>
            <EmptyState kind="noResults" onAction={retry} />
          </Card>
        </div>
        <div className={styles.stack}>
          <Card title={t("refresh.preview.error")}>
            <ErrorState
              code="demo_widget_unavailable"
              requestId="preview-request-202"
              onRetry={retry}
            />
          </Card>
          <Card title={t("refresh.preview.refreshing")} period={<Refreshing />}>
            <div className={styles.stat}>
              <span className={styles.label}>{t("refresh.preview.readings")}</span>
              <strong className={styles.number}>1,284</strong>
              <small>+6.2%</small>
            </div>
          </Card>
          <PreviewUndo />
        </div>
      </div>
    </section>
  );
}
