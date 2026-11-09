import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { Button } from "../../ui/Button.tsx";
export function SupplyReceiptEntry({ isAllowed }: { readonly isAllowed: boolean }) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <Button
      label={t("mobile.supplyReceipt.title")}
      disabled={!isAllowed}
      onPress={() => {
        push({ name: "supplyReceipt" });
      }}
    />
  );
}
