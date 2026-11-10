import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { SettingsState } from "./settings-service.ts";

export function UpdateSupportCard({ state }: { readonly state: SettingsState }) {
  const t = useT();
  return (
    <Card>
      <AppText variant="h2">{t("mobile.settings.version")}</AppText>
      <AppText isMonospace>{state.runningVersion}</AppText>
      <Notice tone="info" icon="shield" message={t("mobile.settings.updaterUnavailable")} />
      <AppText variant="h2">{t("mobile.settings.support")}</AppText>
      <AppText selectable>{state.support ?? t("mobile.settings.supportUnavailable")}</AppText>
    </Card>
  );
}
