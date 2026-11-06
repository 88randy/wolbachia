import type { ChartSeries } from "./chart-types";
import { linePath, chartDashPattern } from "./chart-geometry";
import { ChartPoint } from "./ChartPoint";
import styles from "./analytics.module.css";
interface ChartSeriesLineProps {
  series: ChartSeries;
  index: number;
  domain: { min: number; max: number };
}
/** Dashes and marker shapes distinguish the series in addition to their token color. */
export function ChartSeriesLine({ series, index, domain }: ChartSeriesLineProps) {
  return (
    <g
      data-tone={series.tone ?? (index % 4) + 1}
      className={styles.series}
      data-pattern={index % 4}
    >
      <path
        d={linePath(series.values, domain)}
        vectorEffect="non-scaling-stroke"
        strokeDasharray={chartDashPattern(index)}
      />
      {series.values.map((value, position) => (
        <ChartPoint
          key={position}
          value={value}
          position={position}
          count={series.values.length}
          pattern={index % 4}
          domain={domain}
        />
      ))}
    </g>
  );
}
