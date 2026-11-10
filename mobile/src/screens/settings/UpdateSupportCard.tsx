import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import type { SettingsState } from "./settings-service.ts";

export function UpdateSupportCard({ state }: { readonly state: SettingsState }) {
  const t = useT();
  return (
    <Card>
      <AppText variant="bodyStrong">{t("mobile.settings.support")}</AppText>
      <AppText variant="body" selectable>
        {state.support ?? t("mobile.settings.supportUnavailable")}
      </AppText>
      <AppText variant="caption" tone="secondary">
        {`${t("mobile.settings.version")}: ${state.runningVersion}`}
      </AppText>
    </Card>
  );
}
