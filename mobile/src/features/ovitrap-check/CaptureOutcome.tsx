import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ServerOutcome } from "../shift-open/ServerOutcome.tsx";
export function CaptureOutcome({ event }: { readonly event: OutboxEvent }) {
  const t = useT();
  const { push } = useNavigation();
  const isReceived = ["sent", "in_review", "rejected"].includes(event.status);
  return (
    <View>
      <AppText accessibilityLiveRegion="polite">{t("mobile.ovitrap.phoneSaved")}</AppText>
      <AppText>
        {t(isReceived ? "mobile.ovitrap.serverReceived" : "mobile.ovitrap.serverPending")}
      </AppText>
      <AppText>
        {t(
          event.status === "in_review"
            ? "mobile.ovitrap.reviewPending"
            : "mobile.ovitrap.reviewUnknown",
        )}
      </AppText>
      <ServerOutcome opening={event} />
      <ShiftAction
        label={t("mobile.ovitrap.nextTarget")}
        onPress={() => {
          push({ name: "ovitrapScanner", target: "ovitrap" });
        }}
      />
    </View>
  );
}
