import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "../src/ui/Card";
import { Button } from "../src/ui/Button";
import { useToast } from "../src/ui/ToastProvider";
import styles from "./PreviewComponents.module.css";
export function PreviewUndo() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isVisible, setIsVisible] = useState(true);
  function hideMetric() {
    setIsVisible(false);
    showToast({
      message: t("refresh.preview.hidden"),
      action: {
        label: t("refresh.preview.undo"),
        onAction: () => {
          setIsVisible(true);
        },
      },
    });
  }
  const retry = () => {
    showToast({
      message: t("refresh.preview.failed"),
      tone: "critical",
      action: {
        label: t("refresh.preview.retry"),
        onAction: () => {
          showToast({ message: t("refresh.preview.retryDone"), tone: "success" });
        },
      },
    });
  };
  const review = () => {
    showToast({
      message: t("refresh.preview.reviewToast"),
      action: {
        label: t("refresh.preview.reviewAction"),
        onAction: () => {
          showToast({ message: t("refresh.preview.details") });
        },
      },
    });
  };
  return (
    <Card title={t("refresh.preview.toast")}>
      <div className={styles.stack}>
        <div className={styles.stat}>
          {isVisible ? (
            <>
              <span className={styles.label}>{t("refresh.preview.bags")}</span>
              <strong className={styles.number}>46</strong>
            </>
          ) : (
            <span className={styles.label}>{t("refresh.preview.hidden")}</span>
          )}
        </div>
        {!isVisible && (
          <p id="preview-undo-hint" className={styles.label}>
            {t("ui.preview.undoHint")}
          </p>
        )}
        <div className={styles.row}>
          <Button
            variant="secondary"
            aria-describedby={!isVisible ? "preview-undo-hint" : undefined}
            disabled={!isVisible}
            onClick={hideMetric}
          >
            {t("refresh.preview.hide")}
          </Button>
          <Button variant="tertiary" onClick={retry}>
            {t("refresh.preview.retry")}
          </Button>
          <Button variant="ghost" onClick={review}>
            {t("refresh.preview.reviewAction")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
