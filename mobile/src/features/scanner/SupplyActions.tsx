import { QrCode, TriangleAlert } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";

/** After a supply code: scan another (the main action) or report a problem with it. */
export function SupplyActions({ isAvailable }: { readonly isAvailable: boolean }) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <>
      {isAvailable ? (
        <SecondaryButton
          icon={TriangleAlert}
          label={t("field.scan.report")}
          onPress={() => {
            push({ name: "incidents" });
          }}
        />
      ) : null}
      <PrimaryButton
        icon={QrCode}
        label={t("field.scan.again")}
        onPress={() => {
          push({ name: "qrScanner" });
        }}
      />
    </>
  );
}
