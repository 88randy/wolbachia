import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";
import type { Incident } from "./incidents-query";
import { incidentOriginKey } from "./incident-labels";
import { IncidentStatus } from "./IncidentStatus";
import styles from "./incidents.module.css";

export function IncidentSummaryStatus({ incident }: { incident: Incident }) {
  const { t } = useTranslation();
  return (
    <div className={styles.counts}>
      <IncidentStatus incident={incident} />
      <StatusPill tone={incident.severity === "critical" ? "critical" : "neutral"}>
        {t(`incidents.severity.${incident.severity}`)}
      </StatusPill>
      <span>
        {incident.owner_display ?? t("incidents.workspace.unavailable")} ·{" "}
        {t(incidentOriginKey(incident.origin))}
      </span>
    </div>
  );
}
