/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", {"roles": ["region"]}] -- Named scroll regions must support keyboard scrolling (WCAG 2.1.1). */
import { useTranslation } from "react-i18next";
import { Card } from "../src/ui/Card";
import styles from "./PreviewComponents.module.css";
export function PreviewScroll() {
  const { t } = useTranslation();
  return (
    <Card title={t("refresh.preview.scrollTitle")}>
      {/* WCAG 2.1.1: this named scroll region must support keyboard scrolling. */}
      <div
        tabIndex={0}
        role="region"
        aria-label={t("refresh.preview.scroll")}
        className={styles.scroll}
      >
        <div className={styles.scrollContent}>
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className={styles.scrollLine}>
              <span>
                {t("refresh.preview.code")}
                {": OV-"}
                {String(1284 + index)}
              </span>
              <span>{t("refresh.preview.details")}</span>
              <strong>{t("refresh.preview.centerName")}</strong>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
