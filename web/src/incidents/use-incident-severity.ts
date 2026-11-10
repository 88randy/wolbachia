import { useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { IncidentActionProps } from "./IncidentComment";
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
function submitSeverity(props: IncidentActionProps, severity: Schemas["SeverityEnum"]) {
  void props.submit({
    action: "change_severity",
    body: { expected_revision: props.incident.revision, severity },
  });
}
/** Holds the severity choice and submits the record revision shown to the user. */
export function useIncidentSeverity(props: IncidentActionProps) {
  const { t } = useTranslation();
  const [severity, setSeverity] = useState<Schemas["SeverityEnum"]>(props.incident.severity);
  const isProtected = props.incident.action_prerequisites?.is_severity_protected !== false;
  const options = SEVERITIES.map((value) => ({ value, label: t(`incidents.severity.${value}`) }));
  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = SEVERITIES.find((value) => value === event.target.value);
    if (selected) setSeverity(selected);
  };
  const submit = () => {
    submitSeverity(props, severity);
  };
  const field = {
    id: "incident-severity",
    label: t("incidents.workspace.severity"),
    options,
    value: severity,
    onChange,
  };
  return {
    field,
    submit,
    isProtected,
    isBlocked: props.isBlocked || isProtected || severity === props.incident.severity,
  };
}
