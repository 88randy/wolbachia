import { LaggedToggle } from "./LaggedToggle.tsx";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { CaptureProps } from "./model.ts";
export function BagFields({ model, draft }: CaptureProps) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <View>
      <AppText>{t("mobile.ovitrap.bagHint")}</AppText>
      <ShiftField
        label={t("mobile.ovitrap.bag")}
        disabled={model.isBusy}
        value={draft.bagCode}
        onChange={(bagCode) => {
          model.edit({ bagCode });
        }}
      />
      <ShiftAction
        label={t("mobile.ovitrap.scanBag")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(async () => {
            const result = await model.service.scan("bag");
            if (result === "invalid") push({ name: "invalidOvitrapCode", target: "bag" });
            if (result === "unavailable") model.setError("mobile.ovitrap.scannerUnavailable");
          });
        }}
      />
      <LaggedToggle model={model} draft={draft} />
    </View>
  );
}
