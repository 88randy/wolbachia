import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { Notice } from "../../ui/Notice.tsx";
import type { Schemas } from "@wolbachia/api-client";
import { ReceiptReviewOutcome } from "./ReceiptReviewOutcome.tsx";

interface Props {
  readonly event: OutboxEvent | null;
  readonly signaturePending: boolean;
  readonly review?: Schemas["ReviewHistoryEntry"] | null;
}
function receiptStatusKey(event: OutboxEvent) {
  if (event.status === "sent") return "mobile.supplyReceipt.serverReceived";
  if (event.status === "in_review") return "mobile.supplyReceipt.review";
  if (event.status === "rejected") return "mobile.supplyReceipt.rejected";
  return "mobile.supplyReceipt.saved";
}
export function ReceiptStatus({ event, signaturePending, review }: Props) {
  const t = useT();
  return (
    <View accessibilityLiveRegion="polite">
      {event ? (
        <Notice
          tone={event.status === "sent" ? "info" : "warning"}
          icon={event.status === "sent" ? "cloudOk" : "clock"}
          message={t(receiptStatusKey(event))}
        />
      ) : null}
      <ReceiptReviewOutcome
        review={review?.source_event_id === event?.envelope.id ? (review ?? null) : null}
      />
      {signaturePending ? (
        <Notice
          tone="warning"
          icon="cloudUp"
          message={t("mobile.supplyReceipt.pendingSignature")}
        />
      ) : null}
    </View>
  );
}
