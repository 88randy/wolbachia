import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
export function OvitrapEntry({
  labelKey = "mobile.ovitrap.open",
}: {
  readonly labelKey?: MessageKey;
}) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <ShiftAction
      label={t(labelKey)}
      onPress={() => {
        push({ name: "ovitrapCapture" });
      }}
    />
  );
}
