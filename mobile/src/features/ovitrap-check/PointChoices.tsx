import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { CaptureProps } from "./model.ts";
export function PointChoices({ model, draft }: CaptureProps) {
  const t = useT();
  return (
    <View>
      <AppText variant="h2" accessibilityRole="header">
        {t("mobile.ovitrap.point")}
      </AppText>
      {draft.assignment?.points.map((point) => (
        <ShiftAction
          key={point.id}
          label={point.code}
          selected={draft.point?.id === point.id}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({ point }, draft.eventId);
          }}
        />
      ))}
    </View>
  );
}
