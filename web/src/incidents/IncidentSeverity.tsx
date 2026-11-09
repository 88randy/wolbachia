import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Select } from "../forms/Select";
import { Button } from "../ui/Button";
import type { IncidentActionProps } from "./IncidentComment";
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export function IncidentSeverity({ incident, isBlocked, isBusy, submit }: IncidentActionProps) {
 const { t } = useTranslation();
 const [severity, setSeverity] = useState<Schemas["SeverityEnum"]>(incident.severity);
 const isProtected = incident.action_prerequisites?.is_severity_protected !== false;
 return <fieldset disabled={isBusy}>
 <Select id="incident-severity" label={t("incidents.workspace.severity")} options={SEVERITIES.map(value => ({ value, label: t(`incidents.severity.${value}`) }))} value={severity} onChange={event => { const selected = SEVERITIES.find(value => value === event.target.value); if (selected) setSeverity(selected); }} />
 <Button variant="secondary" aria-disabled={isBlocked || isProtected || severity === incident.severity} onClick={() => { void submit({ action: "change_severity", body: { expected_revision: incident.revision, severity } }); }}>{t("incidents.workspace.changeSeverity")}</Button>
 {isProtected && <p>{t("incidents.workspace.protected")}</p>}
 </fieldset>;
}
