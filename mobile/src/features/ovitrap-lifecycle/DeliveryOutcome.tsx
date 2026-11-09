import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ServerOutcome } from "../shift-open/ServerOutcome.tsx";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { deliveryState } from "./domain.ts";
import { ReviewedOutcome } from "./ReviewedOutcome.tsx";
import type { Schemas } from "@wolbachia/api-client";
export function DeliveryOutcome({
  event,
  reviews = [],
}: {
  readonly event: OutboxEvent;
  readonly reviews?: readonly Schemas["ReviewHistoryEntry"][];
}) {
  const t = useT();
  const delivery = deliveryState(event);
  return (
    <View accessibilityLiveRegion="polite">
      <AppText>{t("mobile.ovitrap.phoneSaved")}</AppText>
      <AppText>
        {t(
          delivery.server === "received"
            ? "mobile.ovitrap.serverReceived"
            : "mobile.ovitrap.serverPending",
        )}
      </AppText>
      <AppText>{t(ingestLabel(delivery.review))}</AppText>
      <ServerOutcome opening={event} />
      {reviews.map((entry) => (
        <ReviewedOutcome key={entry.id} entry={entry} />
      ))}
    </View>
  );
}

function ingestLabel(value: ReturnType<typeof deliveryState>["review"]) {
  if (value === "accepted") return "mobile.lifecycle.ingestAccepted" as const;
  if (value === "rejected") return "mobile.lifecycle.ingestRejected" as const;
  return value === "in_review"
    ? ("mobile.lifecycle.ingestReview" as const)
    : ("mobile.ovitrap.reviewUnknown" as const);
}
