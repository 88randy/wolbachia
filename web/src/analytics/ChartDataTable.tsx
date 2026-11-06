import type { ChartProps } from "./chart-types";
import { ChartTableHead } from "./ChartTableHead";
import { ChartTableBody } from "./ChartTableBody";
import styles from "./analytics.module.css";
/** Values come from the same arrays as the paths: no summarized or sampled substitute. */
export function ChartDataTable(props: ChartProps) {
  /* eslint-disable jsx-a11y/no-noninteractive-tabindex -- This named overflow region must receive keyboard focus for scrolling (UI/UX standard section 10). */
  return (
    <div className={styles.dataScroll} role="region" tabIndex={0} aria-label={props.title}>
      <table className={styles.dataTable}>
        <caption>{props.title}</caption>
        <ChartTableHead series={props.series} />
        <ChartTableBody {...props} />
      </table>
    </div>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
}
