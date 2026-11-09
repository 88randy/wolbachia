import { useTranslation } from "react-i18next";
import type { Incident } from "./incidents-query";
import { StatusPill } from "../ui/StatusPill";
export function IncidentStatus({ incident }: { incident: Incident }) {
 const { t } = useTranslation();
 const isEscalated = incident.state === "open" && incident.stage > 0;
 const state = incident.state === "closed" || incident.state === "voided" ? incident.state : "open";
 return <StatusPill tone={isEscalated ? "critical" : "neutral"}>{t(isEscalated ? "incidents.workspace.escalated" : `incidents.state.${state}`)}</StatusPill>;
}
