import { X } from "lucide-react-native";
import { useT } from "../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../ui/SecondaryButton.tsx";
import { ReviewActions } from "./ReviewActions.tsx";
import { ShootActions } from "./ShootActions.tsx";
import type { CameraCaptureModel } from "./use-camera-capture.ts";

interface Props {
  readonly model: CameraCaptureModel;
  readonly isTorchOn: boolean;
  readonly onTorch: () => void;
  readonly onDone: (fileUri: string | null) => void;
}

/** One main action per step: "Tomar foto", then "Usar esta foto"; cancel is always available. */
export function CameraActions({ model, isTorchOn, onTorch, onDone }: Props) {
  const t = useT();
  return (
    <>
      {model.photo === null ? (
        <ShootActions model={model} isTorchOn={isTorchOn} onTorch={onTorch} />
      ) : (
        <ReviewActions
          retake={model.retake}
          onUse={() => {
            onDone(model.photo);
          }}
        />
      )}
      <SecondaryButton
        icon={X}
        label={t("mobile.camera.cancel")}
        onPress={() => {
          onDone(null);
        }}
      />
    </>
  );
}
