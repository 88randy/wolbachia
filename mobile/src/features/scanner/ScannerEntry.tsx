import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";

export function ScannerEntry({ isAllowed }: { readonly isAllowed: boolean }) {
  const t = useT();
  const { push } = useNavigation();
  if (!isAllowed) return null;
  return (
    <ShiftAction
      label={t("mobile.scanner.title")}
      onPress={() => {
        push({ name: "qrScanner" });
      }}
    />
  );
}
