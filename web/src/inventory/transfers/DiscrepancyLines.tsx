import { useTranslation } from "react-i18next";
import type { Discrepancy } from "./discrepancy-query";
import { discrepancyKindKeys } from "./discrepancy-labels";
import styles from "../inventory.module.css";

export function DiscrepancyLines({ record }: { record: Discrepancy }) {
  const { t } = useTranslation();
  return (
    <ul>
      {record.lines.map((line) => (
        <li key={line.id}>
          {t(discrepancyKindKeys[line.kind])} · <span className={styles.mono}>{line.quantity}</span>
        </li>
      ))}
    </ul>
  );
}
