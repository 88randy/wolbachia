import { GEOMETRY, chartY } from "./chart-geometry";
import styles from "./analytics.module.css";
interface ChartGridProps {
  domain: { min: number; max: number };
}
export const GRID_FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;
/** Only horizontal reference lines; the data owns the visual emphasis. */
export function ChartGrid({ domain }: ChartGridProps) {
  return (
    <g className={styles.grid}>
      {GRID_FRACTIONS.map((fraction) => {
        const ordinate = chartY(domain.min + fraction * (domain.max - domain.min), domain);
        return (
          <line
            key={fraction}
            x1={GEOMETRY.padding}
            x2={GEOMETRY.width - GEOMETRY.padding}
            y1={ordinate}
            y2={ordinate}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}
