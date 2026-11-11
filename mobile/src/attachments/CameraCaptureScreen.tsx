import { View } from "react-native";
import { useRef, useState } from "react";
import type { CameraView } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../i18n/I18nProvider.tsx";
import { AppText } from "../ui/AppText.tsx";
import { InfoNotice } from "../ui/InfoNotice.tsx";
import { cameraFixAction } from "../system-settings/camera-fix.ts";
import { CameraActions } from "./CameraActions.tsx";
import { CameraViewport } from "./CameraViewport.tsx";
import { useCameraCapture } from "./use-camera-capture.ts";
import type { CameraCaptureModel } from "./use-camera-capture.ts";

function Heading({ step }: { readonly step: "take" | "review" }) {
  const t = useT();
  return (
    <View className="gap-1 p-4">
      <AppText variant="h2" tone="onChrome">
        {t(`mobile.camera.${step}Title`)}
      </AppText>
      <AppText tone="onChrome">{t(`mobile.camera.${step}Hint`)}</AppText>
    </View>
  );
}

function Problem({ model }: { readonly model: CameraCaptureModel }) {
  const t = useT();
  if (!model.errorKey) return null;
  const action = cameraFixAction(model.permissionKey, t);
  return <InfoNotice tone="warning" message={t(model.errorKey)} action={action} />;
}

/** Full-screen photo step: big viewfinder, then a preview where the courier keeps or retakes it. */
export function CameraCaptureScreen({
  onDone,
}: {
  readonly onDone: (fileUri: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const view = useRef<CameraView>(null);
  const [isTorchOn, setTorch] = useState(false);
  const model = useCameraCapture(view);
  const padding = { paddingTop: insets.top, paddingBottom: insets.bottom };
  return (
    <View className="flex-1 bg-navy" style={padding}>
      <Heading step={model.photo ? "review" : "take"} />
      <CameraViewport model={model} view={view} isTorchOn={isTorchOn} />
      <View className="gap-3 p-4">
        <Problem model={model} />
        <CameraActions
          model={model}
          isTorchOn={isTorchOn}
          onTorch={() => {
            setTorch(!isTorchOn);
          }}
          onDone={onDone}
        />
      </View>
    </View>
  );
}
