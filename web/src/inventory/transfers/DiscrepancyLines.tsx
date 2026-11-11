import { useTranslation } from "react-i18next";
import type { Discrepancy } from "./discrepancy-query";
import { discrepancyKindKeys } from "./discrepancy-labels";
import { useQuantityText } from "../use-quantity-text";
import styles from "../inventory.module.css";

export function DiscrepancyLines({ record }: { record: Discrepancy }) {
  const { t } = useTranslation();
  const quantityText = useQuantityText();
  return (
    <ul>
      {record.lines.map((line) => (
        <li key={line.id}>
          {t(discrepancyKindKeys[line.kind])} ·{" "}
          <span className={styles.mono}>{quantityText(line.quantity)}</span>
        </li>
      ))}
    </ul>
  );
}
