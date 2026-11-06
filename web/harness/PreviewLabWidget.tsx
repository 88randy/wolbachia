import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "../src/ui/Card";
import { CardMenu } from "../src/ui/CardMenu";
import { MiniBarChart } from "../src/analytics/MiniBarChart";
import { PreviewWidgetMetrics } from "./PreviewWidgetMetrics";
import { PreviewPeriod } from "./PreviewPeriod";
import styles from "./PreviewDashboard.module.css";
export function PreviewLabWidget() {
  const { t } = useTranslation();
  const [hasHistory, setHistory] = useState(false);
  const menu = [
    {
      label: t("refresh.preview.cardMenuAction"),
      onSelect: () => {
        setHistory(!hasHistory);
      },
    },
  ];
  return (
    <Card
      muted
      title={t("refresh.preview.widgetLab")}
      actions={<CardMenu items={menu} />}
      period={<PreviewPeriod />}
    >
      <PreviewWidgetMetrics kind="lab" />
      <MiniBarChart
        title={t("refresh.preview.counted")}
        labels={["30", "31", "01", "02", "03", "04", "05"]}
        values={[56, 73, 64, 91, 78, 102, 102]}
      />
      {hasHistory && <p className={styles.source}>{t("refresh.preview.source")}</p>}
    </Card>
  );
}
