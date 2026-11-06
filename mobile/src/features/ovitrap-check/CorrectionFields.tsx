import { View } from "react-native";
import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import type { CaptureProps } from "./model.ts";
export function CorrectionFields({ model, draft }: CaptureProps) {
  const t = useT();
  const locale = useLocale();
  return (
    <View>
      <AppText>{t("mobile.ovitrap.reasonCode")}</AppText>
      {draft.catalog?.voidReasons.map((item) => (
        <ShiftAction
          key={item.code}
          label={locale === "en" ? item.label_en || item.label_es : item.label_es}
          selected={draft.reasonCode === item.code}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({ reasonCode: item.code }, draft.eventId);
          }}
        />
      ))}
      <ShiftField
        label={t("mobile.ovitrap.reason")}
        disabled={model.isBusy}
        value={draft.reason}
        onChange={(reason) => {
          model.edit({ reason }, draft.eventId);
        }}
      />
      <AppText>{t("mobile.ovitrap.newBag")}</AppText>
    </View>
  );
}
