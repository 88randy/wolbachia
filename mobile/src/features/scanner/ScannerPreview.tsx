import { CameraView } from "expo-camera";
import { spacing } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import type { M07Model } from "./use-m-07.ts";

const styles = StyleSheet.create({ preview: { minHeight: spacing[6] * 4 } });
const BARCODE_SETTINGS = { barcodeTypes: ["qr" as const] };
export function ScannerPreview({ model }: { readonly model: M07Model }) {
  const t = useT();
  if (!model.isCameraVisible) return null;
  return (
    <CameraView
      style={styles.preview}
      facing="back"
      enableTorch={model.isTorchOn}
      accessibilityLabel={t("mobile.scanner.hint")}
      barcodeScannerSettings={BARCODE_SETTINGS}
      onMountError={model.failed}
      onBarcodeScanned={(result) => {
        if (result.type === "qr") void model.read(result.data);
      }}
    />
  );
}
