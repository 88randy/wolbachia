import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
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
    <>
      <InfoNotice
        tone={event.status === "sent" ? "success" : event.status === "rejected" ? "danger" : "info"}
        message={t(statusKey(event))}
      />
      {event.result?.code === "fuel_efficiency_review" ? (
        <InfoNotice tone="warning" message={t("sync.result.fuelEfficiencyReview")} />
      ) : null}
      {hasPendingReceipt(state) ? (
        <InfoNotice tone="warning" message={t("mobile.fuel.receiptPending")} />
      ) : (
        <InfoNotice tone="success" message={t("mobile.fuel.receiptVerified")} />
      )}
      <FuelReviewOutcome review={review?.source_event_id === event.envelope.id ? review : null} />
    </>
  );
}
