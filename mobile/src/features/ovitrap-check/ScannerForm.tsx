import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
interface Props {
  readonly code: string;
  readonly setCode: (code: string) => void;
  readonly isBusy: boolean;
  readonly enter: () => void;
}
export function ScannerForm({ code, setCode, isBusy, enter }: Props) {
  const t = useT();
  return (
    <View>
      <Notice tone="info" icon="phone" message={t("mobile.ovitrap.manualHint")} />
      <ShiftField
        disabled={isBusy}
        label={t("mobile.ovitrap.code")}
        value={code}
        onChange={setCode}
      />
      <ShiftAction
        label={t("mobile.ovitrap.lookup")}
        disabled={isBusy || !code.trim()}
        onPress={enter}
      />
    </View>
  );
}
