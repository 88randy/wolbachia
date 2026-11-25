import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { eventTypeKey } from "../../sync/inbox-model.ts";
import { AppText } from "../../ui/AppText.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import { STATUS_PRESENTATION } from "../../ui/status-presentation.ts";
import type { HistoryEntry } from "./domain.ts";
import { HistoryProvenance } from "./HistoryProvenance.tsx";

export function HistoryCard({
  entry,
  formattedTime,
}: {
  readonly entry: HistoryEntry;
  readonly formattedTime: string | null;
}) {
  const t = useT();
  const { tone, icon: Icon, label } = STATUS_PRESENTATION[entry.status]; // D4: shared with P28/P33
  const color = useTheme().theme.color.status[tone].fg;
  return (
    <View className="gap-2 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <View className="flex-row items-center gap-3">
        <Icon color={color} size={26} strokeWidth={2.25} />
        <View className="flex-1">
          <AppText variant="bodyStrong">
            {t(entry.isServerDecision ? "mobile.history.serverFact" : eventTypeKey(entry.kind))}
          </AppText>
          <AppText variant="caption" style={{ color }}>
            {t(label)}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" tone="secondary">
        {formattedTime ?? t("mobile.history.unknownTime")}
      </AppText>
      <HistoryProvenance entry={entry} />
    </View>
  );
}
