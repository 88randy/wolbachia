import { incidentOriginKey } from "./incident-labels";
import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";
import { Card } from "../ui/Card";
import type { Incident } from "./incidents-query";
import { IncidentDeadline } from "./IncidentDeadline";
import { IncidentLinkedRecord } from "./IncidentLinkedRecord";
import { IncidentStatus } from "./IncidentStatus";
import styles from "./incidents.module.css";
export function IncidentSummary({ incident }: { incident: Incident }) {
 const { t } = useTranslation();
 return <>
 <div className={styles.counts}><IncidentStatus incident={incident} /><StatusPill tone={incident.severity === "critical" ? "critical" : "neutral"}>{t(`incidents.severity.${incident.severity}`)}</StatusPill><span>{incident.owner_display ?? t("incidents.workspace.unavailable")} · {t(incidentOriginKey(incident.origin))}</span></div>
 <div className={styles.summary}>
 <Card title={t("incidents.workspace.deadline")}><IncidentDeadline deadline={incident.deadline} /></Card>
 <Card title={t("incidents.workspace.linked")}><IncidentLinkedRecord record={incident.linked_record} /></Card>
 <Card title={t("incidents.workspace.blocks")}>
 {incident.blockers.length ? <ul>{incident.blockers.map(blocker => <li key={blocker.id}>
 {t(blocker.is_active ? "incidents.workspace.blockActive" : "incidents.workspace.blockCleared")} · {blocker.kind} · <IncidentLinkedRecord record={blocker.resource} />
 </li>)}</ul> : <p>{t("incidents.workspace.noBlocks")}</p>}
 </Card>
 </div>
 <Card title={t("incidents.workspace.report")}><p>{incident.description}</p></Card>
 </>;
}
