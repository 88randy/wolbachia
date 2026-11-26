import type { MessageKey } from "@wolbachia/i18n";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { IncidentState } from "./types.ts";

function deliveryKey(event: OutboxEvent): MessageKey {
  if (event.status === "sent") return "mobile.incidents.serverReceived";
  if (event.status === "in_review") return "mobile.incidents.reviewPending";
  if (event.status === "rejected") return "mobile.incidents.rejected";
  return "mobile.incidents.saved";
}

/** A transport receipt never proves a person read a report or assistance is on its way. */
export function IncidentStatus({ state }: { readonly state: IncidentState }) {
  const t = useT();
  if (!state.event) return null;
  const isReceived = state.event.status === "sent";
  return (
    <>
      <InfoNotice
        tone={isReceived ? "success" : state.event.status === "rejected" ? "danger" : "info"}
        message={t(deliveryKey(state.event))}
      />
      {state.evidencePending ? (
        <InfoNotice tone="warning" message={t("mobile.incidents.evidencePending")} />
      ) : null}
      <InfoNotice tone="info" message={t("mobile.incidents.noDeliveryPromise")} />
    </>
  );
}
