import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { DiscrepancyManifest } from "./DiscrepancyManifest";

export function DiscrepancyEvent({
  event,
  lines,
}: {
  event: Schemas["TransferEvent"];
  lines: readonly Schemas["TransferLine"][];
}) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <details>
      <summary>
        {t(`discrepancies.event.${event.kind}`)} · {format(event.server_received_at)}
      </summary>
      <DiscrepancyManifest manifest={event.manifest} lines={lines} />
      {event.manifest.reason && <p>{event.manifest.reason}</p>}
    </details>
  );
}
