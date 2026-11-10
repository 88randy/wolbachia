import { CameraView } from "expo-camera";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import type { M07Model } from "./use-m-07.ts";

const BARCODE_SETTINGS = { barcodeTypes: ["qr" as const] };

/** Big camera window with rounded corners; it opens by itself and stops when the screen is left. */
export function ScannerPreview({ model }: { readonly model: M07Model }) {
  const t = useT();
  if (!model.isCameraVisible) return null;
  return (
    <View className="h-80 overflow-hidden rounded-card bg-navy">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={model.isTorchOn}
        accessibilityLabel={t("field.scan.hint")}
        barcodeScannerSettings={BARCODE_SETTINGS}
        onMountError={model.failed}
        onBarcodeScanned={(result) => {
          if (result.type === "qr") void model.read(result.data);
        }}
      />
    </View>
  );
}
