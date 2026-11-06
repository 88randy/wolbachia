import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ChartTableDisclosure } from "./ChartTableDisclosure";
import { MiniBars } from "./MiniBars";
import styles from "./analytics.module.css";
interface MiniBarChartProps {
  title: string;
  labels: readonly string[];
  values: readonly number[];
  valueSuffix?: string;
}
/** A compact zero-baseline chart retains its complete table in a disclosure. */
export function MiniBarChart({ title, labels, values, valueSuffix = "" }: MiniBarChartProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const series = [{ id: "values", label: title, values }];
  return (
    <figure className={styles.miniChart} aria-labelledby={titleId}>
      <figcaption className={styles.chartTitle} id={titleId}>
        {title}
      </figcaption>
      {labels.length ? (
        <MiniBars labels={labels} values={values} />
      ) : (
        <p>{t("analytics.chart.noData")}</p>
      )}
      <ChartTableDisclosure
        title={title}
        labels={labels}
        series={series}
        valueSuffix={valueSuffix}
      />
    </figure>
  );
}
