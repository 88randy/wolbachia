import { LaggedToggle } from "./LaggedToggle.tsx";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { CaptureProps } from "./model.ts";
function scanBag({ model, draft }: CaptureProps, onInvalid: () => void): void {
  void model.run(
    async () => {
      const result = await model.service.scan("bag", draft.eventId);
      if (result === "invalid") onInvalid();
      if (result === "unavailable") model.setError("mobile.ovitrap.scannerUnavailable");
    },
    { eventId: draft.eventId },
  );
}
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
          model.edit({ bagCode }, draft.eventId);
        }}
      />
      <ShiftAction
        label={t("mobile.ovitrap.scanBag")}
        disabled={model.isBusy}
        onPress={() => {
          scanBag({ model, draft }, () => {
            push({ name: "invalidOvitrapCode", target: "bag" });
          });
        }}
      />
      <LaggedToggle model={model} draft={draft} />
    </View>
  );
}
