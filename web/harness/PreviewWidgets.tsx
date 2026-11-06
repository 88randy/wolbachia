import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../src/ui/Button";
import { PreviewLabWidget } from "./PreviewLabWidget";
import { PreviewFieldWidget } from "./PreviewFieldWidget";
import styles from "./PreviewDashboard.module.css";
export function PreviewWidgets() {
  const { t } = useTranslation();
  const [hasFailure, setFailure] = useState(true);
  return (
    <aside className={styles.rail} aria-label={t("refresh.preview.partial")}>
      <PreviewLabWidget />
      <div className={styles.partialLabel}>
        <span>{t("refresh.preview.partial")}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFailure(!hasFailure);
          }}
        >
          {t(hasFailure ? "refresh.preview.retry" : "refresh.preview.error")}
        </Button>
      </div>
      <PreviewFieldWidget
        hasFailure={hasFailure}
        onRetry={() => {
          setFailure(false);
        }}
      />
    </aside>
  );
}
