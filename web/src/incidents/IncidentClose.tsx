import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import type { IncidentActionProps } from "./IncidentComment";
import type { IncidentScope } from "./incidents-query";
import { IncidentEvidence } from "./IncidentEvidence";
import { IncidentDraftField } from "./IncidentDraftField";
import { IncidentActionConfirmation } from "./IncidentActionConfirmation";
import { useIncidentClose } from "./use-incident-close";
export function IncidentClose(props: IncidentActionProps & { scope: IncidentScope }) {
  const { t } = useTranslation();
  const form = useIncidentClose(props);
  return (
    <Card title={t("incidents.workspace.close")}>
      <p>{t("incidents.workspace.requiredEvidence", { count: form.requiredEvidence })}</p>
      <IncidentDraftField {...form.field} />
      <IncidentEvidence {...form.evidence} />
      {!form.confirmation.isEnabled && <p>{t("incidents.workspace.closeBlocked")}</p>}
      <IncidentActionConfirmation action="close" {...form.confirmation} />
    </Card>
  );
}
