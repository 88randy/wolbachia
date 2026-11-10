import { useTranslation } from "react-i18next";
import { TransferEventHistory } from "./TransferEventHistory";
import type { Transfer } from "./transfer-query";
import styles from "../inventory.module.css";
export function TransferHistory({ transfer }: { transfer: Transfer }) {
  const { t } = useTranslation();
  return (
    <section className={styles.notes}>
      <h2>{t("transfers.history.title")}</h2>
      <dl className={styles.summary}>
        <dt>{t("transfers.field.origin")}</dt>
        <dd>{transfer.origin_id}</dd>
        <dt>{t("transfers.field.destination")}</dt>
        <dd>{transfer.destination_id}</dd>
      </dl>
      {transfer.events.map((event) => (
        <TransferEventHistory key={event.id} event={event} />
      ))}
    </section>
  );
}
