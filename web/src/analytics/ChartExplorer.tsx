import type { ChartProps } from "./chart-types";
import { ChartRange } from "./ChartRange";
import { TrendPlot } from "./TrendPlot";
import { useChartPosition } from "./use-chart-position";
import styles from "./analytics.module.css";
/** Hover and the keyboard control inspect the very same period and raw values. */
export function ChartExplorer(props: ChartProps) {
  const { active, setActive, onPointerMove, onPointerLeave } = useChartPosition(
    props.labels.length,
  );
  return (
    <div className={styles.chartExplorer}>
      <TrendPlot
        {...props}
        active={active}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      />
      <ChartRange {...props} active={active} onSelect={setActive} />
    </div>
  );
}
