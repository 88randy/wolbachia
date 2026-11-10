import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleReferences({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  const unavailable = t("mobile.sample.unavailable");
  return (
    <Card>
      <AppText variant="caption">{t("mobile.sample.identity")}</AppText>
      <AppText isMonospace>{model.sampleId ?? unavailable}</AppText>
      <AppText variant="caption">{t(model.sourceKindKey ?? "mobile.sample.source")}</AppText>
      <AppText variant="bodyStrong">{model.sourceLabel ?? unavailable}</AppText>
      <AppText isMonospace>{model.sourceId ?? unavailable}</AppText>
      <AppText variant="caption">{t("mobile.sample.origin")}</AppText>
      <AppText>{model.originLabel ?? unavailable}</AppText>
      <AppText isMonospace>{model.selectedOrigin ?? unavailable}</AppText>
      <AppText variant="caption">{t("mobile.sample.method")}</AppText>
      <AppText>{model.methodLabel ?? unavailable}</AppText>
      <AppText isMonospace>{model.selectedMethod ?? unavailable}</AppText>
    </Card>
  );
}
