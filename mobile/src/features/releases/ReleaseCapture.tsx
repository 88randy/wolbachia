import { MapPin } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { ReleaseQuantity } from "./ReleaseQuantity.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseCapture({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  const disabled = model.isBusy || !model.canEdit || model.status !== "draft";
  const accuracy =
    model.gpsAccuracy === null
      ? undefined
      : `${t("mobile.release.gpsAccuracy")}: ${String(model.gpsAccuracy)}`;
  return (
    <>
      <ReleaseQuantity model={model} disabled={disabled} />
      <SecondaryButton
        icon={MapPin}
        label={t("mobile.release.acquireGps")}
        accessibilityHint={accuracy}
        disabled={disabled}
        onPress={model.acquireGps}
      />
    </>
  );
}
