import { useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Card } from "../../ui/Card.tsx";
import { Badge } from "../../ui/Badge.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
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
  const t = useT(),
    [isOpen, setOpen] = useState(false);
  const label = `${incident.code}: ${incident.type_snapshot?.label ?? t("mobile.incidents.report")}`;
  return (
    <Card>
      <ShiftAction
        label={label}
        onPress={() => {
          setOpen(!isOpen);
        }}
      />
      <Badge
        tone={incident.state === "closed" ? "success" : "info"}
        icon="list"
        label={t(STATE_KEYS[incident.state] ?? "incidents.workspace.unavailable")}
      />
      {isOpen ? <IncidentThread incident={incident} /> : null}
    </Card>
  );
}
