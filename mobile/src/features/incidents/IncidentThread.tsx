import { View } from "react-native";
import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";

const EVENT_KEYS: Readonly<Record<Schemas["IncidentEvent"]["action"], MessageKey>> = {
  report: "incidents.event.report",
  comment: "incidents.event.comment",
  reassign: "incidents.event.reassign",
  change_severity: "incidents.event.changeSeverity",
  close: "incidents.event.close",
  void: "incidents.event.void",
  escalate: "incidents.event.escalate",
  reminder: "incidents.event.reminder",
};

export function IncidentThread({ incident }: { readonly incident: Schemas["ReportedIncident"] }) {
  const t = useT();
  return (
    <View className="gap-2">
      <AppText variant="body">{incident.description}</AppText>
      {incident.timeline.length ? (
        incident.timeline.map((entry) => (
          <View key={entry.id} className="gap-0.5 rounded-2xl bg-surface-muted p-3">
            <AppText variant="bodyStrong">{t(EVENT_KEYS[entry.action])}</AppText>
            <AppText variant="caption" tone="secondary">
              {entry.author_display ?? t("incidents.workspace.unavailable")}
            </AppText>
            {entry.text ? <AppText variant="body">{entry.text}</AppText> : null}
          </View>
        ))
      ) : (
        <AppText variant="caption" tone="secondary">
          {t("incidents.workspace.noEvents")}
        </AppText>
      )}
    </View>
  );
}
