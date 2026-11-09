import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { IncidentComment } from "./IncidentComment";
import { IncidentReassign } from "./IncidentReassign";
import { IncidentSeverity } from "./IncidentSeverity";
import { IncidentVoid } from "./IncidentVoid";
import { IncidentClose } from "./IncidentClose";
import type { IncidentActionProps } from "./IncidentComment";
import type { IncidentScope } from "./incidents-query";
export function IncidentActions(props: IncidentActionProps & { scope: IncidentScope }) {
  const { t } = useTranslation();
  const permissions = props.incident.action_permissions;
  return (
    <>
      <Card title={t("incidents.workspace.actions")}>
        {props.isBlocked && <p>{t("incidents.workspace.actionsBlocked")}</p>}
        <IncidentComment {...props} />
        {permissions.reassign && <IncidentReassign {...props} />}
        {permissions.change_severity && <IncidentSeverity {...props} />}
        {permissions.void && <IncidentVoid {...props} />}
      </Card>
      {permissions.close && <IncidentClose {...props} />}
    </>
  );
}
