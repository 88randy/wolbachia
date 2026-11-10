import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatDateTime } from "../../format/use-format-date-time";
import styles from "../inventory.module.css";
import { DiscrepancyManifest } from "./DiscrepancyManifest";
export function TransferEventHistory({ event }: { event: Schemas["TransferEvent"] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <details open={event.kind === "receive"}>
      <summary>
        {t(`transfers.event.${event.kind}`)} · {format(event.server_received_at)}
      </summary>
      <p className={styles.mono}>{event.manifest_hash}</p>
      <p>{t("transfers.history.revision", { revision: event.revision })}</p>
      <ul>
        {event.manifest.evidence.map((evidence) => (
          <li key={evidence.upload_id}>
            {t("transfers.history.evidence", { role: evidence.role })}{" "}
            <span className={styles.mono}>{evidence.upload_id}</span>
          </li>
        ))}
      </ul>
      <DiscrepancyManifest manifest={event.manifest} />
    </details>
  );
}
