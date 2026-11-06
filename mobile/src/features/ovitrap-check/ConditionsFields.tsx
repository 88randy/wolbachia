import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ConditionField } from "./ConditionField.tsx";
import type { CaptureProps } from "./model.ts";
export function ConditionsFields({ model, draft }: CaptureProps) {
  const t = useT();
  return (
    <View>
      <AppText variant="h2" accessibilityRole="header">
        {t("mobile.ovitrap.conditions")}
      </AppText>
      <ConditionField
        disabled={model.isBusy}
        label={t("mobile.ovitrap.temperature")}
        value={draft.temperature}
        onChange={(temperature) => {
          model.edit({ temperature }, draft.eventId);
        }}
      />
      <ConditionField
        disabled={model.isBusy}
        label={t("mobile.ovitrap.humidity")}
        value={draft.humidity}
        onChange={(humidity) => {
          model.edit({ humidity }, draft.eventId);
        }}
      />
    </View>
  );
}
