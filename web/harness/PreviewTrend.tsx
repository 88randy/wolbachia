import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../src/i18n/use-language";
import { Card } from "../src/ui/Card";
import { CardMenu } from "../src/ui/CardMenu";
import { Refreshing } from "../src/ui/Refreshing";
import { TrendChart } from "../src/analytics/TrendChart";
import { PreviewPeriod } from "./PreviewPeriod";
import styles from "./PreviewDashboard.module.css";
export function PreviewTrend() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [isRefreshing, setRefreshing] = useState(true);
  const dates = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat(language, { month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 7, 17 + index * 7)),
    ),
  );
  const series = [
    {
      id: "coverage",
      label: t("refresh.preview.coverage"),
      values: [48, 57, 53, 67, 61, 75, 69, 78, 72, 86, 81, 94],
      tone: 1 as const,
    },
    {
      id: "processing",
      label: t("refresh.preview.processing"),
      values: [35, 42, 39, 54, 49, 58, 55, 69, 65, 73, 70, 82],
      tone: 2 as const,
    },
    {
      id: "target",
      label: t("refresh.preview.target"),
      values: [65, 65, 65, 65, 70, 70, 70, 75, 75, 75, 80, 80],
      tone: 3 as const,
    },
  ];
  const menu = [
    {
      label: t("refresh.preview.refreshing"),
      onSelect: () => {
        setRefreshing(!isRefreshing);
      },
    },
  ];
  return (
    <Card
      title={t("refresh.preview.trend")}
      actions={<CardMenu label={t("refresh.preview.cardMenu")} items={menu} />}
      period={<PreviewPeriod weeks />}
    >
      <div className={styles.refreshLine}>
        <span>{t("refresh.preview.refreshing")}</span>
        {isRefreshing && <Refreshing />}
      </div>
      <TrendChart
        title={t("refresh.preview.coverage")}
        labels={dates}
        series={series}
        valueSuffix="%"
      />
    </Card>
  );
}
