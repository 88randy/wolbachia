import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleBlockers({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (model.status !== "draft" || model.blockers.length === 0) return null;
  return (
    <Card>
      {model.blockers.map((key) => (
        <Notice key={key} tone="warning" icon="alert" message={t(key)} />
      ))}
      <AppText variant="caption">{t("mobile.sample.blockedHint")}</AppText>
    </Card>
  );
}
