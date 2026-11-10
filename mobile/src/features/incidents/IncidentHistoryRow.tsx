import { CircleCheck, Clock } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import { IncidentThread } from "./IncidentThread.tsx";

const STATE_KEYS: Readonly<Record<string, MessageKey>> = {
  open: "incidents.state.open",
  closed: "incidents.state.closed",
  voided: "incidents.state.voided",
};
export function IncidentHistoryRow({
  incident,
}: {
  readonly incident: Schemas["ReportedIncident"];
}) {
  const t = useT();
  const { theme } = useTheme();
  const [isOpen, setOpen] = useState(false);
  const isClosed = incident.state === "closed";
  const Icon = isClosed ? CircleCheck : Clock;
  const color = isClosed ? theme.color.status.success.fg : theme.color.status.info.fg;
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={incident.type_snapshot?.label ?? t("mobile.incidents.report")}
        onPress={() => {
          setOpen(!isOpen);
        }}
        className="min-h-14 flex-row items-center gap-3"
      >
        <Icon color={color} size={24} strokeWidth={2.25} />
        <View className="flex-1">
          <AppText variant="bodyStrong">
            {incident.type_snapshot?.label ?? t("mobile.incidents.report")}
          </AppText>
          <AppText variant="caption" style={{ color }}>
            {t(STATE_KEYS[incident.state] ?? "incidents.workspace.unavailable")}
          </AppText>
        </View>
      </Pressable>
      {isOpen ? <IncidentThread incident={incident} /> : null}
    </View>
  );
}
