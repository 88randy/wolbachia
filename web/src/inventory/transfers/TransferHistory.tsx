import { useTranslation } from "react-i18next";
import { useLocationNames } from "../use-location-names";
import { TransferEventHistory } from "./TransferEventHistory";
import type { Transfer } from "./transfer-query";
import styles from "../inventory.module.css";
export function TransferHistory({ transfer }: { transfer: Transfer }) {
  const { t } = useTranslation();
  const nameOf = useLocationNames();
  return (
    <section className={styles.notes}>
      <dl className={styles.summary}>
        <dt>{t("transfers.field.origin")}</dt>
        <dd>{nameOf(transfer.origin_id) ?? t("inventory.state.unconfigured")}</dd>
        <dt>{t("transfers.field.destination")}</dt>
        <dd>{nameOf(transfer.destination_id) ?? t("inventory.state.unconfigured")}</dd>
      </dl>
      {transfer.events.map((event) => (
        <TransferEventHistory key={event.id} event={event} />
      ))}
    </section>
  );
}
