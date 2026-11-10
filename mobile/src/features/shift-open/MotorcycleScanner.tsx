import { CameraView } from "expo-camera";
import { QrCode, X } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { MotorcycleOption } from "./domain.ts";
import { useMotorcycleScan } from "./use-motorcycle-scan.ts";

const BARCODE_SETTINGS = { barcodeTypes: ["qr" as const] };

interface Props {
  readonly options: readonly MotorcycleOption[];
  readonly onFound: (option: MotorcycleOption) => void;
}

/** "Escanear QR de la moto": one button that opens the camera and picks the motorcycle by itself. */
export function MotorcycleScanner({ options, onFound }: Props) {
  const t = useT();
  const scan = useMotorcycleScan(options, onFound);
  return (
    <View className="gap-3">
      {scan.isScanning ? (
        <>
          <View className="h-64 overflow-hidden rounded-card bg-navy">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              accessibilityLabel={t("field.open.scanHint")}
              barcodeScannerSettings={BARCODE_SETTINGS}
              onMountError={scan.stop}
              onBarcodeScanned={(result) => {
                if (result.type === "qr") scan.read(result.data);
              }}
            />
          </View>
          <SecondaryButton icon={X} label={t("field.action.cancel")} onPress={scan.stop} />
        </>
      ) : (
        <SecondaryButton
          icon={QrCode}
          label={t("field.open.scanMotorcycle")}
          onPress={() => {
            void scan.start();
          }}
        />
      )}
      {scan.problem === "denied" ? (
        <InfoNotice tone="warning" message={t("field.scan.cameraDenied")} />
      ) : null}
      {scan.problem === "unknown" ? (
        <InfoNotice tone="warning" message={t("field.open.scanUnknown")} />
      ) : null}
    </View>
  );
}
