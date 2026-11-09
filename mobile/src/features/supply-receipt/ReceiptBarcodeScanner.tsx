import { isReceiptReadOnly } from "./editing.ts";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ReceiptScannerModal } from "./ReceiptScannerModal.tsx";
import { useReceiptScanner } from "./use-receipt-scanner.ts";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptBarcodeScanner({ model }: { readonly model: M05Model }) {
  const t = useT();
  const scanner = useReceiptScanner(model);
  return (
    <View>
      <ShiftAction
        label={t("mobile.supplyReceipt.startScanner")}
        disabled={isReceiptReadOnly(model) || scanner.isRequesting}
        onPress={() => {
          void scanner.start();
        }}
      />
      {scanner.errorKey ? (
        <Notice tone="warning" icon="alert" message={t(scanner.errorKey)} />
      ) : null}
      <ReceiptScannerModal scanner={scanner} />
    </View>
  );
}
