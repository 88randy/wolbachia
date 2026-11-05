import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { CaptureCommand } from "./CaptureCommand.tsx";
import { CorrectionFields } from "./CorrectionFields.tsx";
import type { CaptureProps } from "./model.ts";
export function RepeatCheck(props: CaptureProps) {
  const t = useT();
  return (
    <View>
      <AppText>{t("mobile.ovitrap.repeat")}</AppText>
      {props.draft.replacesEventId ? (
        <CorrectionFields {...props} />
      ) : (
        <CaptureCommand model={props.model} command="correct" />
      )}
    </View>
  );
}
