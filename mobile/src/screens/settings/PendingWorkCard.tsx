import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { SettingsState } from "./settings-service.ts";

export function PendingWorkCard({
  state,
  onInbox,
}: {
  readonly state: SettingsState;
  readonly onInbox: () => void;
}) {
  const t = useT();
  return (
    <Card>
      <AppText variant="h2">{t("mobile.settings.pendingWork")}</AppText>
      <AppText>{t("mobile.settings.events")}</AppText>
      <AppText isMonospace>{state.pendingEvents}</AppText>
      <AppText>{t("mobile.settings.files")}</AppText>
      <AppText isMonospace>{state.pendingFiles}</AppText>
      <AppText>{t("mobile.settings.drafts")}</AppText>
      <AppText isMonospace>{state.drafts}</AppText>
      <Notice tone="info" icon="lock" message={t("mobile.settings.lockHint")} />
      <Button variant="outline" label={t("mobile.settings.viewUploads")} onPress={onInbox} />
    </Card>
  );
}
