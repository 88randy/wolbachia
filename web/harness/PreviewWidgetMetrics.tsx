import { useTranslation } from "react-i18next";
import { useLanguage } from "../src/i18n/use-language";
import { KpiCell } from "../src/analytics/KpiCell";
import styles from "./PreviewDashboard.module.css";
interface PreviewWidgetMetricsProps {
  kind: "lab" | "field";
}
export function PreviewWidgetMetrics({ kind }: PreviewWidgetMetricsProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const number = new Intl.NumberFormat(language);
  const isLab = kind === "lab";
  const stats = isLab
    ? [
        [t("refresh.preview.received"), 697],
        [t("refresh.preview.counted"), 566],
        [t("refresh.preview.pending"), 46],
      ]
    : [
        [t("refresh.preview.routes"), 22],
        [t("refresh.preview.visits"), 1284],
        [t("refresh.preview.incidents"), 12],
      ];
  return (
    <>
      <div className={styles.innerMetric}>
        <KpiCell
          label={t(isLab ? "refresh.preview.received" : "refresh.preview.teams")}
          value={number.format(isLab ? 697 : 16)}
          delta={isLab ? 16 : 2}
          deltaUnit=""
          href={isLab ? "/lab" : "/operations"}
        />
      </div>
      <dl className={styles.metricList}>
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{number.format(Number(value))}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
