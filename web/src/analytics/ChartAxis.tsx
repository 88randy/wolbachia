import { useLanguage } from "../i18n/use-language";
import { GRID_FRACTIONS } from "./ChartGrid";
import styles from "./analytics.module.css";
interface ChartAxisProps {
  labels: readonly string[];
  domain: { min: number; max: number };
  suffix: string;
}
/** HTML labels keep the 12 px minimum even when the SVG plot scales down. */
export function ChartAxis({ labels, domain, suffix }: ChartAxisProps) {
  const { language } = useLanguage();
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 0 });
  const stride = Math.max(1, Math.ceil(labels.length / 4));
  return (
    <>
      <div className={styles.yAxis} aria-hidden="true">
        {[...GRID_FRACTIONS].reverse().map((fraction) => (
          <span key={fraction}>
            {number.format(domain.min + fraction * (domain.max - domain.min))}
            {suffix}
          </span>
        ))}
      </div>
      <div className={styles.xAxis} aria-hidden="true">
        {labels
          .filter((_, index) => index % stride === 0 || index === labels.length - 1)
          .map((label, index) => (
            <span key={index}>{label}</span>
          ))}
      </div>
    </>
  );
}
