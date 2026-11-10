import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { CameraFeedback } from "./CameraFeedback.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M07Model } from "./use-m-07.ts";

export function CameraControls({ model }: { readonly model: M07Model }) {
  const t = useT();
  return (
    <View>
      <CameraFeedback model={model} />
      <ShiftAction
        label={t("mobile.scanner.start")}
        disabled={model.isBusy || model.isRequesting}
        onPress={() => {
          void model.start();
        }}
      />
      {model.isCameraVisible ? (
        <ShiftAction
          label={t(model.isTorchOn ? "mobile.scanner.torchOff" : "mobile.scanner.torchOn")}
          selected={model.isTorchOn}
          onPress={() => {
            model.setTorch(!model.isTorchOn);
          }}
        />
      ) : null}
    </View>
  );
}
