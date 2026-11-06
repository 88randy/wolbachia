import { GEOMETRY, chartX } from "./chart-geometry";
import type { ChartSeries } from "./chart-types";
import { ChartValueList } from "./ChartValueList";
import styles from "./analytics.module.css";
interface ChartTooltipProps {
  index: number;
  labels: readonly string[];
  series: readonly ChartSeries[];
  suffix: string;
}
export function ChartTooltip({ index, labels, series, suffix }: ChartTooltipProps) {
  const percentage = (chartX(index, labels.length) / GEOMETRY.width) * 100;
  return (
    <div
      className={styles.chartTooltip}
      ref={(element) => {
        element?.style.setProperty("--chart-x", `${String(percentage)}%`);
      }}
    >
      <strong>{labels[index]}</strong>
      <ChartValueList series={series} index={index} suffix={suffix} />
    </div>
  );
}
