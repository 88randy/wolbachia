import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { incidentBlockerKey } from "../../incidents/incident-labels";
import type { IncidentType } from "./incident-types-query";
import styles from "./incident-types.module.css";
const FIELDS = [
  { field: "label", key: "incidentTypes.field.label" },
  { field: "icon", key: "incidentTypes.field.icon" },
  { field: "supervisor_display", key: "incidentTypes.field.supervisor" },
  { field: "coordinator_display", key: "incidentTypes.field.coordinator" },
  { field: "terminal_display", key: "incidentTypes.field.terminal" },
  { field: "supervisor_sla_seconds", key: "incidentTypes.field.supervisorSla" },
  { field: "coordinator_sla_seconds", key: "incidentTypes.field.coordinatorSla" },
  { field: "report_evidence_min", key: "incidentTypes.field.reportEvidence" },
  { field: "close_evidence_min", key: "incidentTypes.field.closeEvidence" },
] as const;
export function TypeSnapshot({ item }: { item: IncidentType }) {
  const { t } = useTranslation();
  return (
    <dl className={styles.snapshot}>
      {FIELDS.map(({ field, key }) => (
        <Fragment key={field}>
          <dt>{t(key)}</dt>
          <dd>{item[field] ?? t("incidentTypes.owner.unavailable")}</dd>
        </Fragment>
      ))}
      <dt>{t("incidentTypes.field.severity")}</dt>
      <dd>{t(`incidents.severity.${item.severity}`)}</dd>
      <dt>{t("incidentTypes.field.blockers")}</dt>
      <dd>
        {Array.isArray(item.blocker_kinds) && item.blocker_kinds.length
          ? item.blocker_kinds
              .map((kind: unknown) =>
                typeof kind === "string"
                  ? t(incidentBlockerKey(kind))
                  : t("incidents.blocker.unknown"),
              )
              .join(", ")
          : t("incidentTypes.form.noBlockers")}
      </dd>
      <dt>{t("incidentTypes.field.active")}</dt>
      <dd>{t(item.is_active ? "incidentTypes.status.active" : "incidentTypes.status.inactive")}</dd>
    </dl>
  );
}
