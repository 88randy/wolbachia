import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { BagFields } from "./BagFields.tsx";
import type { CaptureProps } from "./model.ts";
export function PaddleFields(props: CaptureProps) {
  const { model, draft } = props;
  const t = useT();
  const locale = useLocale();
  return (
    <View>
      <AppText>{t("mobile.ovitrap.paddleType")}</AppText>
      {draft.catalog?.paddleTypes.map((item) => (
        <ShiftAction
          key={item.code}
          label={locale === "en" ? item.label_en || item.label_es : item.label_es}
          selected={draft.paddleType === item.code}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({ paddleType: item.code });
          }}
        />
      ))}
      <BagFields {...props} />
    </View>
  );
}
