import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { Disclosure } from "../../ui/Disclosure";
import { DiscrepancyManifest } from "./DiscrepancyManifest";
export function TransferEventHistory({
  event,
  lines,
}: {
  event: Schemas["TransferEvent"];
  lines: readonly Schemas["TransferLine"][];
}) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <Disclosure
      defaultOpen={event.kind === "receive"}
      title={`${t(`transfers.event.${event.kind}`)} · ${format(event.server_received_at)}`}
    >
      <DiscrepancyManifest manifest={event.manifest} lines={lines} />
    </Disclosure>
  );
}
