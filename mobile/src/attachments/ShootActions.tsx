import { Camera } from "lucide-react-native";
import { useT } from "../i18n/I18nProvider.tsx";
import { PrimaryButton } from "../ui/PrimaryButton.tsx";
import { TorchButton } from "./TorchButton.tsx";
import type { CameraCaptureModel } from "./use-camera-capture.ts";

/** Before the shot: the big shutter (disabled with its reason until the camera is ready) and the torch. */
export function ShootActions({
  model,
  isTorchOn,
  onTorch,
}: {
  readonly model: CameraCaptureModel;
  readonly isTorchOn: boolean;
  readonly onTorch: () => void;
}) {
  const t = useT();
  return (
    <>
      <PrimaryButton
        icon={Camera}
        label={t("mobile.camera.shoot")}
        disabled={!model.isReady || model.isBusy}
        isLoading={model.isBusy}
        disabledReason={model.isReady ? undefined : t("mobile.camera.waiting")}
        onPress={() => {
          void model.shoot();
        }}
      />
      {model.isPermitted ? <TorchButton isOn={isTorchOn} onPress={onTorch} /> : null}
    </>
  );
}
