import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ServerOutcome } from "../shift-open/ServerOutcome.tsx";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { deliveryState } from "./domain.ts";
import { reviewLabel } from "./delivery-label.ts";
export function DeliveryOutcome({ event }: { readonly event: OutboxEvent }) {
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
      <AppText>{t(reviewLabel(delivery.review))}</AppText>
      <ServerOutcome opening={event} />
    </View>
  );
}
