import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { DiscrepancyManifest } from "./DiscrepancyManifest";
import styles from "../inventory.module.css";

export function DiscrepancyEvent({ event }: { event: Schemas["TransferEvent"] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <details>
      <summary>
        {t(`discrepancies.event.${event.kind}`)} · {format(event.server_received_at)}
      </summary>
      <p className={styles.mono}>
        {t("discrepancies.history.hash")}: {event.manifest_hash}
      </p>
      <DiscrepancyManifest manifest={event.manifest} />
      <ul>
        {event.manifest.evidence.map((proof) => (
          <li key={proof.upload_id} className={styles.mono}>
            {t("discrepancies.history.evidence")}: {proof.upload_id} · {proof.sha256}
          </li>
        ))}
      </ul>
      {event.manifest.reason && <p>{event.manifest.reason}</p>}
    </details>
  );
}
