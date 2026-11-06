import { GEOMETRY } from "./chart-geometry";
import { MiniBarShape } from "./MiniBarShape";
import styles from "./analytics.module.css";
interface MiniBarsProps {
  labels: readonly string[];
  values: readonly number[];
}
/** Bar geometry uses the zero baseline; rounded top corners come from a token. */
export function MiniBars({ labels, values }: MiniBarsProps) {
  const maximum = Math.max(1, ...values);
  return (
    <>
      <svg
        className={styles.miniSvg}
        viewBox={`0 0 ${String(GEOMETRY.width)} ${String(GEOMETRY.miniHeight)}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {values.map((value, index) => (
          <MiniBarShape
            key={index}
            value={value}
            index={index}
            maximum={maximum}
            count={values.length}
          />
        ))}
      </svg>
      <div className={styles.barLabels} aria-hidden="true">
        {labels.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
    </>
  );
}
