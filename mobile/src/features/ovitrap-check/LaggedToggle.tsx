import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { CaptureProps } from "./model.ts";
export function LaggedToggle({ model, draft }: CaptureProps) {
  const t = useT();
  return (
    <View>
      <ShiftAction
        label={t("mobile.ovitrap.lagged")}
        selected={draft.isLagged}
        disabled={model.isBusy}
        onPress={() => {
          model.edit({ isLagged: !draft.isLagged });
        }}
      />
      {draft.isLagged ? <AppText>{t("mobile.ovitrap.laggedHint")}</AppText> : null}
    </View>
  );
}
