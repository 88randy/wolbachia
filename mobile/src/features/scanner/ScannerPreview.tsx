import { CameraView } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { memo, useCallback, useRef } from "react";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import type { M07Model } from "./use-m-07.ts";

const BARCODE_SETTINGS = { barcodeTypes: ["qr" as const] };
const CAMERA_STYLE = { flex: 1 };

interface LiveCameraProps {
  readonly isTorchOn: boolean;
  readonly label: string;
  readonly onScan: (result: BarcodeScanningResult) => void;
  readonly onMountError: () => void;
}

/**
 * Every prop is a primitive or stable, and the component is memoized: banners, location and safety
 * updates re-render the screen, but never reach the native camera view (a prop change there tears
 * the camera down and opens it again, which shows as flicker).
 */
const LiveCamera = memo(function LiveCamera(props: LiveCameraProps) {
  return (
    <CameraView
      style={CAMERA_STYLE}
      facing="back"
      enableTorch={props.isTorchOn}
      accessibilityLabel={props.label}
      barcodeScannerSettings={BARCODE_SETTINGS}
      onMountError={props.onMountError}
      onBarcodeScanned={props.onScan}
    />
  );
});

/** Big camera window with rounded corners; it opens by itself and stops when the screen is left. */
export function ScannerPreview({ model }: { readonly model: M07Model }) {
  const t = useT();
  const latest = useRef(model);
  latest.current = model;
  const onScan = useCallback((result: BarcodeScanningResult) => {
    if (result.type === "qr") void latest.current.read(result.data);
  }, []);
  const onMountError = useCallback(() => {
    latest.current.failed();
  }, []);
  if (!model.isCameraVisible) return null;
  return (
    <View className="h-80 overflow-hidden rounded-card bg-navy">
      <LiveCamera
        isTorchOn={model.isTorchOn}
        label={t("field.scan.hint")}
        onScan={onScan}
        onMountError={onMountError}
      />
    </View>
  );
}
