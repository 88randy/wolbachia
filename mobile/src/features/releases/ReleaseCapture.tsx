import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { ReleaseQuantity } from "./ReleaseQuantity.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseCapture({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  const disabled = model.isBusy || !model.canEdit || model.status !== "draft";
  return (
    <Card>
      <ReleaseQuantity model={model} disabled={disabled} />
      <AppText>{t("mobile.release.gpsAccuracy")}</AppText>
      <AppText isMonospace>{model.gpsAccuracy ?? t("mobile.release.referenceUnavailable")}</AppText>
      <Button
        variant="outline"
        icon="location"
        label={t("mobile.release.acquireGps")}
        disabled={disabled}
        onPress={model.acquireGps}
      />
    </Card>
  );
}
