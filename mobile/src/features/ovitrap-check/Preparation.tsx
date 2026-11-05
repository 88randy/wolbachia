import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { PLACEMENT_PREPARATION, PREPARATION } from "./domain.ts";
import type { CaptureProps } from "./model.ts";
export function Preparation({ model, draft }: CaptureProps) {
  const t = useT();
  const required = draft.mode === "place" ? PLACEMENT_PREPARATION : PREPARATION;
  return (
    <View>
      <AppText variant="h2" accessibilityRole="header">
        {t("mobile.ovitrap.prepare")}
      </AppText>
      {required.map((key) => (
        <ShiftAction
          key={key}
          label={t(`mobile.ovitrap.${key}`)}
          selected={draft.prepared.includes(key)}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({
              prepared: draft.prepared.includes(key)
                ? draft.prepared.filter((item) => item !== key)
                : [...draft.prepared, key],
            });
          }}
        />
      ))}
    </View>
  );
}
