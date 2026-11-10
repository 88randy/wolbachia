import { MapPin } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleLocation({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  const accuracy =
    model.gpsAccuracy === null
      ? undefined
      : `${t("mobile.sample.gps")}: ${String(model.gpsAccuracy)}`;
  return (
    <SecondaryButton
      icon={MapPin}
      label={t("mobile.sample.acquireGps")}
      accessibilityHint={accuracy}
      disabled={model.isBusy || !model.canEdit || model.status !== "draft"}
      onPress={model.acquireGps}
    />
  );
}
