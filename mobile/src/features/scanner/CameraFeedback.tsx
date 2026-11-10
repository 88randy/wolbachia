import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M07Model } from "./use-m-07.ts";

export function CameraFeedback({ model }: { readonly model: M07Model }) {
  const t = useT();
  if (!model.cameraError) return null;
  return (
    <View>
      <Notice
        tone="warning"
        icon="alert"
        message={t(
          model.cameraError === "denied" ? "mobile.scanner.denied" : "mobile.scanner.cameraFailed",
        )}
      />
      {model.cameraError === "denied" ? (
        <ShiftAction label={t("mobile.scanner.settings")} onPress={model.settings} />
      ) : null}
    </View>
  );
}
