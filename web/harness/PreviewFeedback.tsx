import { useTranslation } from "react-i18next";
import { Card } from "../src/ui/Card";
import { StatusPill } from "../src/ui/StatusPill";
import { InlineNotice } from "../src/ui/InlineNotice";
import { Banner } from "../src/ui/Banner";
import { Button } from "../src/ui/Button";
import { useToast } from "../src/ui/ToastProvider";
import styles from "./PreviewComponents.module.css";
const TONES = [
  { tone: "success", key: "good" },
  { tone: "warning", key: "warning" },
  { tone: "critical", key: "critical" },
  { tone: "info", key: "info" },
  { tone: "neutral", key: "neutral" },
] as const;
export function PreviewFeedback() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return (
    <Card title={t("ui.preview.feedback")}>
      <div className={styles.stack}>
        <div className={styles.row}>
          {TONES.map(({ tone, key }) => (
            <StatusPill key={tone} tone={tone}>
              {t(`refresh.preview.${key}`)}
            </StatusPill>
          ))}
        </div>
        {TONES.map(({ tone, key }) => (
          <InlineNotice key={tone} tone={tone}>
            {t(`refresh.preview.${key}`)}
            {": "}
            {t("refresh.preview.notice")}
          </InlineNotice>
        ))}
        <Banner
          tone="info"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                showToast({ message: t("refresh.preview.reviewToast") });
              }}
            >
              {t("refresh.preview.reviewAction")}
            </Button>
          }
        >
          {t("refresh.preview.reviewToast")}
        </Banner>
      </div>
    </Card>
  );
}
