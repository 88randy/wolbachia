import { Ban, CircleCheck, Clock, Eye } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { eventTypeKey, STATUS_BADGE_KEY } from "../../sync/inbox-model.ts";
import { AppText } from "../../ui/AppText.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import type { HistoryEntry } from "./domain.ts";
import { HistoryProvenance } from "./HistoryProvenance.tsx";

type Tone = "success" | "warning" | "danger" | "info";
interface Presentation {
  readonly tone: Tone;
  readonly icon: LucideIcon;
  readonly label: MessageKey;
}

function presentation(entry: HistoryEntry): Presentation {
  if (entry.status === "reviewed")
    return { tone: "success", icon: CircleCheck, label: "mobile.history.reviewed" };
  if (entry.status === "voided")
    return { tone: "danger", icon: Ban, label: "mobile.history.voided" };
  if (entry.status === "observed")
    return { tone: "warning", icon: Eye, label: "mobile.history.observed" };
  if (entry.status === "sent")
    return { tone: "success", icon: CircleCheck, label: "mobile.history.received" };
  return { tone: "info", icon: Clock, label: STATUS_BADGE_KEY[entry.status] };
}
export function HistoryCard({
  entry,
  formattedTime,
}: {
  readonly entry: HistoryEntry;
  readonly formattedTime: string | null;
}) {
  const t = useT();
  const { theme } = useTheme();
  const state = presentation(entry);
  const status = theme.color.status;
  const color = {
    success: status.success.fg,
    warning: status.warning.fg,
    danger: status.critical.fg,
    info: status.info.fg,
  }[state.tone];
  const Icon = state.icon;
  return (
    <View className="gap-2 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <View className="flex-row items-center gap-3">
        <Icon color={color} size={26} strokeWidth={2.25} />
        <View className="flex-1">
          <AppText variant="bodyStrong">
            {t(entry.isServerDecision ? "mobile.history.serverFact" : eventTypeKey(entry.kind))}
          </AppText>
          <AppText variant="caption" style={{ color }}>
            {t(state.label)}
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
