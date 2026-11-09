import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import type { Incident } from "./incidents-query";
import { IncidentDeadline } from "./IncidentDeadline";
import { IncidentLinkedRecord } from "./IncidentLinkedRecord";
import { IncidentSummaryStatus } from "./IncidentSummaryStatus";
import { IncidentBlockers } from "./IncidentBlockers";
import styles from "./incidents.module.css";

export function IncidentSummary({ incident }: { incident: Incident }) {
  const { t } = useTranslation();
  return (
    <>
      <IncidentSummaryStatus incident={incident} />
      <div className={styles.summary}>
        <Card title={t("incidents.workspace.deadline")}>
          <IncidentDeadline deadline={incident.deadline} />
        </Card>
        <Card title={t("incidents.workspace.linked")}>
          <IncidentLinkedRecord record={incident.linked_record} />
        </Card>
        <IncidentBlockers blockers={incident.blockers} />
      </div>
      <Card title={t("incidents.workspace.report")}>
        <p>{incident.description}</p>
      </Card>
    </>
  );
}
