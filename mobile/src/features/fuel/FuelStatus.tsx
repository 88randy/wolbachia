import { View } from "react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { FuelReviewOutcome } from "./FuelReviewOutcome.tsx";
import type { FuelState } from "./types.ts";

function statusKey(event: OutboxEvent): MessageKey {
  if (event.status === "sent") return "mobile.fuel.serverReceived";
  if (event.status === "in_review") return "mobile.fuel.reviewPending";
  if (event.status === "rejected") return "mobile.fuel.rejected";
  return "mobile.fuel.saved";
}
function hasPendingReceipt(state: FuelState): boolean {
  return state.receiptPending || state.draft?.receipt == null;
}
export function FuelStatus({ state }: { readonly state: FuelState }) {
  const t = useT();
  const { event, review } = state;
  if (!event) return null;
  return (
    <View accessibilityLiveRegion="polite">
      <Notice
        tone={event.status === "sent" ? "info" : "warning"}
        icon={event.status === "sent" ? "cloudOk" : "clock"}
        message={t(statusKey(event))}
      />
      {event.result?.code === "fuel_efficiency_review" ? (
        <Notice tone="warning" icon="alert" message={t("sync.result.fuelEfficiencyReview")} />
      ) : null}
      {hasPendingReceipt(state) ? (
        <Notice tone="warning" icon="cloudUp" message={t("mobile.fuel.receiptPending")} />
      ) : (
        <Notice tone="info" icon="check" message={t("mobile.fuel.receiptVerified")} />
      )}
      <FuelReviewOutcome review={review?.source_event_id === event.envelope.id ? review : null} />
    </View>
  );
}
