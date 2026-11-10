import { AlertTriangle, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import { useLanguage } from "../../i18n/use-language";
import { formatInventoryQuantity } from "../format-inventory-quantity";
import { NO_NAME } from "../../lookups/use-reference-names";
import type { DeliveryRow } from "./delivery-compare";
import styles from "../inventory.module.css";

const STATE_KEYS: Record<DeliveryRow["state"], MessageKey> = {
  complete: "allocation.assignment.stateComplete",
  short: "allocation.assignment.stateShort",
  over: "allocation.assignment.stateOver",
  unsuggested: "allocation.assignment.stateUnsuggested",
  invalid: "allocation.assignment.stateInvalid",
};
type Lots = readonly Schemas["Lot"][] | undefined;

function materialLabel(lots: Lots, supplyVersionId: string) {
  const lot = lots?.find((item) => item.supply_version_id === supplyVersionId);
  return lot?.supply_version.label ?? NO_NAME;
}

function DeliveryLine({ row, lots }: { row: DeliveryRow; lots: Lots }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const format = (value: string) => formatInventoryQuantity(value, language);
  const Icon = row.state === "complete" ? Check : AlertTriangle;
  return (
    <tr>
      <th scope="row">{materialLabel(lots, row.supplyVersionId)}</th>
      <td className={styles.number}>{row.suggested === null ? "—" : format(row.suggested)}</td>
      <td className={styles.number}>{format(row.delivered || "0")}</td>
      <td>
        <Icon aria-hidden="true" size={14} /> {t(STATE_KEYS[row.state], { count: format(row.gap) })}
      </td>
    </tr>
  );
}

/** Suggested vs delivered per material; each state has an icon and text, never color alone. */
export function DeliveryTable({ rows, lots }: { rows: readonly DeliveryRow[]; lots: Lots }) {
  const { t } = useTranslation();
  return (
    <table className={styles.matrix}>
      <caption>{t("allocation.assignment.deliveryCaption")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("allocation.reconciliation.supply")}</th>
          <th scope="col">{t("allocation.assignment.suggested")}</th>
          <th scope="col">{t("allocation.assignment.delivered")}</th>
          <th scope="col">{t("allocation.assignment.state")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <DeliveryLine key={row.supplyVersionId} row={row} lots={lots} />
        ))}
      </tbody>
    </table>
  );
}
