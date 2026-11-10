import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import type { Discrepancy } from "./discrepancy-query";
import styles from "../inventory.module.css";

export function DiscrepancyHolds({ record }: { record: Discrepancy }) {
  const { t } = useTranslation();
  return (
    <>
      <InlineNotice>{t("discrepancies.holds.explanation")}</InlineNotice>
      <ul>
        {record.holds.map((hold) => (
          <li key={hold.id} className={styles.mono}>
            {hold.lot_id} · {hold.location_id} ·{" "}
            {t(hold.resolution_id ? "discrepancies.holds.released" : "discrepancies.holds.active")}
          </li>
        ))}
      </ul>
    </>
  );
}
