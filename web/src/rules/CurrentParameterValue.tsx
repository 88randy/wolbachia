import { useFormatNumber } from "../format/use-formatters";
import { useParameterLabels } from "./parameter-labels";
import { NotConfiguredBadge } from "./NotConfiguredBadge";
import type { RuleParameter } from "./rules-query";
import styles from "./rules.module.css";
export function CurrentParameterValue({ parameter }: { parameter: RuleParameter }) {
  const labels = useParameterLabels();
  const formatNumber = useFormatNumber();
  if (parameter.value === null) return <NotConfiguredBadge />;
  return (
    <span className={styles.bigValue}>
      {formatNumber(parameter.value)} {labels.unit(parameter.unit)}
    </span>
  );
}
