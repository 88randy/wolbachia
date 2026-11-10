import { Inbox } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import type { SettingsState } from "./settings-service.ts";

function Count({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <View className="flex-1 items-center gap-1 rounded-2xl bg-surface-muted p-3">
      <AppText variant="number">{value}</AppText>
      <AppText variant="caption" tone="secondary" className="text-center">
        {label}
      </AppText>
    </View>
  );
}

export function PendingWorkCard({
  state,
  onInbox,
}: {
  readonly state: SettingsState;
  readonly onInbox: () => void;
}) {
  const t = useT();
  return (
    <>
      <SectionTitle title={t("mobile.settings.pendingWork")} />
      <View className="flex-row gap-2">
        <Count label={t("mobile.settings.events")} value={state.pendingEvents} />
        <Count label={t("mobile.settings.files")} value={state.pendingFiles} />
        <Count label={t("mobile.settings.drafts")} value={state.drafts} />
      </View>
      <InfoNotice tone="info" message={t("mobile.settings.lockHint")} />
      <SecondaryButton icon={Inbox} label={t("mobile.settings.viewUploads")} onPress={onInbox} />
    </>
  );
}
