import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { DeliveryOutcome } from "./DeliveryOutcome.tsx";
import type { CorrectionItem } from "./types.ts";
export function CorrectionHistory({
  corrections,
}: {
  readonly corrections: readonly CorrectionItem[];
}) {
  const t = useT();
  return (
    <View>
      {corrections.map((item) => (
        <View key={item.event.envelope.id}>
          <AppText>{t("mobile.lifecycle.voided")}</AppText>
          <AppText>{item.reason}</AppText>
          <AppText>{item.event.envelope.id}</AppText>
          <DeliveryOutcome event={item.event} />
        </View>
      ))}
    </View>
  );
}
