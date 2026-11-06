import type { PointerEventHandler } from "react";
import type { ChartProps } from "./chart-types";
import { ChartTooltip } from "./ChartTooltip";
import { ChartAxis } from "./ChartAxis";
import { ChartGrid } from "./ChartGrid";
import { ChartSeriesLine } from "./ChartSeriesLine";
import { GEOMETRY, chartDomain } from "./chart-geometry";
import styles from "./analytics.module.css";
interface TrendPlotProps extends ChartProps {
  active: number | null;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerLeave: PointerEventHandler<HTMLDivElement>;
}
/** Geometry scales independently of labels, preserving readable text on narrow viewports. */
export function TrendPlot({
  labels,
  series,
  valueSuffix = "",
  active,
  onPointerMove,
  onPointerLeave,
}: TrendPlotProps) {
  const domain = chartDomain(series);
  const viewBox = `0 0 ${String(GEOMETRY.width)} ${String(GEOMETRY.height)}`;
  return (
    <div className={styles.plotArea} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <svg
        className={styles.trendSvg}
        viewBox={viewBox}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ChartGrid domain={domain} />
        {series.map((item, index) => (
          <ChartSeriesLine key={item.id} series={item} index={index} domain={domain} />
        ))}
      </svg>
      <ChartAxis labels={labels} domain={domain} suffix={valueSuffix} />
      {active !== null && (
        <ChartTooltip index={active} labels={labels} series={series} suffix={valueSuffix} />
      )}
    </div>
  );
}
