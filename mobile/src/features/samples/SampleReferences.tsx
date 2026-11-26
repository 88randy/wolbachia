import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import type { SampleViewModel } from "./view-model.ts";

/** What is being sampled, in words: source, origin and method (no internal ids). */
export function SampleReferences({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  const unavailable = t("mobile.sample.unavailable");
  return (
    <Card>
      <AppText variant="caption" tone="secondary">
        {t(model.sourceKindKey ?? "mobile.sample.source")}
      </AppText>
      <AppText variant="bodyStrong">{model.sourceLabel ?? unavailable}</AppText>
      <AppText variant="caption" tone="secondary">
        {t("mobile.sample.origin")}
      </AppText>
      <AppText variant="bodyStrong">{model.originLabel ?? unavailable}</AppText>
      <AppText variant="caption" tone="secondary">
        {t("mobile.sample.method")}
      </AppText>
      <AppText variant="bodyStrong">{model.methodLabel ?? unavailable}</AppText>
    </Card>
  );
}
