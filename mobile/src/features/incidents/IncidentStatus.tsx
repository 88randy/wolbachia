import { View } from "react-native";
import type { MessageKey } from "@wolbachia/i18n";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
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
    <View accessibilityLiveRegion="polite">
      <Notice
        tone={isReceived ? "info" : "warning"}
        icon={isReceived ? "cloudOk" : "clock"}
        message={t(deliveryKey(state.event))}
      />
      {state.evidencePending ? (
        <Notice tone="warning" icon="cloudUp" message={t("mobile.incidents.evidencePending")} />
      ) : null}
      <Notice tone="info" icon="alert" message={t("mobile.incidents.noDeliveryPromise")} />
    </View>
  );
}
