import { View } from "react-native";
import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";

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
    <View>
      <AppText>{incident.description}</AppText>
      <AppText variant="bodyStrong" accessibilityRole="header">
        {t("incidents.workspace.thread")}
      </AppText>
      {incident.timeline.length ? (
        incident.timeline.map((entry) => (
          <Card key={entry.id}>
            <AppText variant="bodyStrong">{t(EVENT_KEYS[entry.action])}</AppText>
            <AppText>{entry.author_display ?? t("incidents.workspace.unavailable")}</AppText>
            <AppText variant="caption" isMonospace>
              {entry.created_at}
            </AppText>
            {entry.text ? <AppText>{entry.text}</AppText> : null}
          </Card>
        ))
      ) : (
        <AppText>{t("incidents.workspace.noEvents")}</AppText>
      )}
    </View>
  );
}
