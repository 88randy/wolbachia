import type { MessageKey } from "@wolbachia/i18n";
import { View } from "react-native";
import { Notice } from "../../ui/Notice.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
export function OvitrapEntry({
  isAllowed,
  labelKey = "mobile.ovitrap.open",
}: {
  readonly isAllowed: boolean;
  readonly labelKey?: MessageKey;
}) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <View>
      {!isAllowed ? (
        <Notice tone="warning" icon="alert" message={t("mobile.ovitrap.shiftBlocked")} />
      ) : null}
      <ShiftAction
        disabled={!isAllowed}
        label={t(labelKey)}
        onPress={() => {
          if (!isAllowed) return;
          push({ name: "ovitrapCapture" });
        }}
      />
    </View>
  );
}
