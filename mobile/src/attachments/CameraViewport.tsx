import { CameraView } from "expo-camera";
import { Image, StyleSheet, View } from "react-native";
import type { RefObject } from "react";
import { useT } from "../i18n/I18nProvider.tsx";
import type { CameraCaptureModel } from "./use-camera-capture.ts";

const styles = StyleSheet.create({ fill: { flex: 1 } });

function Preview({ uri }: { readonly uri: string }) {
  const t = useT();
  return (
    <Image
      source={{ uri }}
      style={styles.fill}
      resizeMode="contain"
      accessibilityLabel={t("mobile.camera.previewLabel")}
    />
  );
}

/** The big window: live camera before the shot, the taken photo after it. */
export function CameraViewport({
  model,
  view,
  isTorchOn,
}: {
  readonly model: CameraCaptureModel;
  readonly view: RefObject<CameraView | null>;
  readonly isTorchOn: boolean;
}) {
  const t = useT();
  return (
    <View className="flex-1 overflow-hidden bg-navy">
      {model.photo ? <Preview uri={model.photo} /> : null}
      {!model.photo && model.isPermitted ? (
        <CameraView
          ref={view}
          style={styles.fill}
          facing="back"
          enableTorch={isTorchOn}
          accessibilityLabel={t("mobile.camera.viewfinderLabel")}
          onCameraReady={model.markReady}
          onMountError={model.fail}
        />
      ) : null}
    </View>
  );
}
