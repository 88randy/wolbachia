import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { ChartProps } from "./chart-types";
import { ChartLegend } from "./ChartLegend";
import { ChartExplorer } from "./ChartExplorer";
import { ChartTableDisclosure } from "./ChartTableDisclosure";
import styles from "./analytics.module.css";
/** Thin series with unsampled, equivalent tabular data and keyboard period inspection. */
export function TrendChart(props: ChartProps) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <figure className={styles.chart} aria-labelledby={titleId}>
      <figcaption id={titleId} className={styles.chartTitle}>
        {props.title}
      </figcaption>
      <ChartLegend series={props.series} />
      {props.labels.length ? <ChartExplorer {...props} /> : <p>{t("analytics.chart.noData")}</p>}
      <ChartTableDisclosure {...props} />
    </figure>
  );
}
