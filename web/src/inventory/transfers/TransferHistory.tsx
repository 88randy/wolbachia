import { useTranslation } from "react-i18next";
import { useLocationNames } from "../use-location-names";
import { Fact, FactGrid } from "./Fact";
import { TransferEventHistory } from "./TransferEventHistory";
import type { Transfer } from "./transfer-query";
import styles from "../inventory.module.css";
export function TransferHistory({ transfer }: { transfer: Transfer }) {
  const { t } = useTranslation();
  const nameOf = useLocationNames();
  return (
    <section className={styles.notes}>
      <FactGrid>
        <Fact label={t("transfers.field.origin")}>
          {nameOf(transfer.origin_id) ?? t("inventory.state.unconfigured")}
        </Fact>
        <Fact label={t("transfers.field.destination")}>
          {nameOf(transfer.destination_id) ?? t("inventory.state.unconfigured")}
        </Fact>
      </FactGrid>
      {transfer.events.map((event) => (
        <TransferEventHistory key={event.id} event={event} lines={transfer.lines} />
      ))}
    </section>
  );
}
