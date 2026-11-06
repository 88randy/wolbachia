import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import { deltaDirection } from "./kpi-delta";
import styles from "./analytics.module.css";
interface KpiDeltaProps {
  delta: number;
  unit: string;
}
const DELTA_ICON = { up: ArrowUpRight, down: ArrowDownRight, unchanged: Minus };
/** Signs, direction icons and a spoken comparison also work without color. */
export function KpiDelta({ delta, unit }: KpiDeltaProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const direction = deltaDirection(delta);
  const DeltaIcon = DELTA_ICON[direction];
  const signed =
    new Intl.NumberFormat(language, { signDisplay: "exceptZero", maximumFractionDigits: 2 }).format(
      delta,
    ) + unit;
  return (
    <span className={styles[direction]}>
      <span className={styles.deltaVisual} aria-hidden="true">
        <DeltaIcon strokeWidth={1.5} />
        <span>{signed}</span>
      </span>
      <span className={styles.srOnly}>
        {t(`analytics.delta.${direction}`)} {signed} {t("analytics.delta.comparison")}
      </span>
    </span>
  );
}
