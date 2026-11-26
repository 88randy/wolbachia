import { QrCode } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { openSystemSetting } from "../../system-settings/open-system-setting.ts";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { isReceiptReadOnly } from "./editing.ts";
import { ReceiptScannerModal } from "./ReceiptScannerModal.tsx";
import { useReceiptScanner } from "./use-receipt-scanner.ts";
import type { M05Model } from "./use-m-05.ts";

/** "Escanear caja": counts a box by its QR instead of typing. */
export function ReceiptScanButton({ model }: { readonly model: M05Model }) {
  const t = useT();
  const scanner = useReceiptScanner(model);
  return (
    <>
      <SecondaryButton
        icon={QrCode}
        label={t("field.receipt.scanBox")}
        disabled={isReceiptReadOnly(model) || scanner.isRequesting}
        onPress={() => {
          void scanner.start();
        }}
      />
      {scanner.errorKey ? (
        <InfoNotice
          tone="warning"
          message={t(
            scanner.errorKey === "mobile.supplyReceipt.scannerPermission"
              ? scanner.errorKey
              : "field.receipt.scanProblem",
          )}
          action={
            scanner.errorKey === "mobile.supplyReceipt.scannerPermission"
              ? {
                  label: t("field.scan.openSettings"),
                  onPress: () => {
                    void openSystemSetting("app");
                  },
                }
              : undefined
          }
        />
      ) : null}
      {model.state?.feedback === "duplicate" ? (
        <InfoNotice tone="info" message={t("field.receipt.scanDuplicate")} />
      ) : null}
      <ReceiptScannerModal scanner={scanner} />
    </>
  );
}
