import { Flashlight, FlashlightOff, QrCode, Settings } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { M07Model } from "./use-m-07.ts";

/** Torch, camera problems and a way to start again; the camera itself opens on its own. */
export function CameraControls({ model }: { readonly model: M07Model }) {
  const t = useT();
  return (
    <>
      {model.cameraError ? (
        <>
          <InfoNotice
            tone="warning"
            message={t(
              model.cameraError === "denied"
                ? "field.scan.cameraDenied"
                : "field.scan.cameraFailed",
            )}
          />
          {model.cameraError === "denied" ? (
            <SecondaryButton
              icon={Settings}
              label={t("field.scan.openSettings")}
              onPress={model.settings}
            />
          ) : (
            <SecondaryButton
              icon={QrCode}
              label={t("field.scan.again")}
              disabled={model.isBusy || model.isRequesting}
              onPress={() => {
                void model.start();
              }}
            />
          )}
        </>
      ) : null}
      {model.isCameraVisible ? (
        <SecondaryButton
          icon={model.isTorchOn ? FlashlightOff : Flashlight}
          label={t(model.isTorchOn ? "field.scan.torchOff" : "field.scan.torchOn")}
          onPress={() => {
            model.setTorch(!model.isTorchOn);
          }}
        />
      ) : null}
    </>
  );
}
