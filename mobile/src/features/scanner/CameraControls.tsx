import { Camera, Flashlight, FlashlightOff, QrCode, Settings } from "lucide-react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { M07Model } from "./use-m-07.ts";

const MESSAGE: Readonly<Record<NonNullable<M07Model["cameraError"]>, MessageKey>> = {
  denied: "field.scan.cameraAsk",
  blocked: "field.scan.cameraDenied",
  cameraFailed: "field.scan.cameraFailed",
};

/** Torch and camera problems; every problem has the button that fixes it. */
export function CameraControls({ model }: { readonly model: M07Model }) {
  const t = useT();
  const { cameraError } = model;
  return (
    <>
      {cameraError ? (
        <>
          <InfoNotice tone="warning" message={t(MESSAGE[cameraError])} />
          {cameraError === "blocked" ? (
            <SecondaryButton
              icon={Settings}
              label={t("field.scan.openSettings")}
              onPress={model.settings}
            />
          ) : (
            <SecondaryButton
              icon={cameraError === "denied" ? Camera : QrCode}
              label={t(cameraError === "denied" ? "field.scan.allowCamera" : "field.scan.again")}
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
