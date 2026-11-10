import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleLocation({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  return (
    <Card>
      <AppText>{t("mobile.sample.gps")}</AppText>
      <AppText isMonospace>{model.gpsAccuracy ?? t("mobile.sample.unavailable")}</AppText>
      <Button
        variant="outline"
        icon="location"
        label={t("mobile.sample.acquireGps")}
        disabled={model.isBusy || !model.canEdit || model.status !== "draft"}
        onPress={model.acquireGps}
      />
    </Card>
  );
}
