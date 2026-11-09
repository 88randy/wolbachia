import { spacing } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import { useT } from "../../i18n/I18nProvider.tsx";
import type { ReceiptScannerModel } from "./use-receipt-scanner.ts";

const styles = StyleSheet.create({ preview: { flex: 1, minHeight: spacing[6] * 3 } });
const BARCODE_SETTINGS = { barcodeTypes: ["qr" as const] };
export function ReceiptBarcodePreview({ scanner }: { readonly scanner: ReceiptScannerModel }) {
  const t = useT();
  return (
    <CameraView
      style={styles.preview}
      facing="back"
      mode="picture"
      accessibilityLabel={t("mobile.supplyReceipt.scannerHint")}
      barcodeScannerSettings={BARCODE_SETTINGS}
      onMountError={scanner.failed}
      onBarcodeScanned={(result) => {
        if (result.type === "qr") scanner.read(result.data);
      }}
    />
  );
}
