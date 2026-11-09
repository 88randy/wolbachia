import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { Incident } from "./incidents-query";
import type { IncidentCommand } from "./incident-command";
import { IncidentDraftField } from "./IncidentDraftField";
import { useIncidentComment } from "./use-incident-comment";
export interface IncidentActionProps {
  incident: Incident;
  isBlocked: boolean;
  isBusy: boolean;
  submit: (command: IncidentCommand) => Promise<boolean>;
}
export function IncidentComment(props: IncidentActionProps) {
  const { t } = useTranslation();
  const form = useIncidentComment(props);
  if (!props.incident.action_permissions.comment) return null;
  return (
    <form onSubmit={form.onSubmit}>
      <IncidentDraftField {...form.field} />
      <Button type="submit" aria-disabled={form.isBlocked} loading={props.isBusy}>
        {t("incidents.workspace.sendComment")}
      </Button>
    </form>
  );
}
