import type { ChartSeries } from "./chart-types";
import styles from "./analytics.module.css";
interface ChartLegendProps {
  series: readonly ChartSeries[];
}
export function ChartLegend({ series }: ChartLegendProps) {
  return (
    <ul className={styles.legend}>
      {series.map((item, index) => (
        <li key={item.id}>
          <span
            className={styles.legendMarker}
            data-tone={item.tone ?? (index % 4) + 1}
            data-pattern={index % 4}
            aria-hidden="true"
          />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
