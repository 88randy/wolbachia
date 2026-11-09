import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";
import type { IncidentScope } from "./incidents-query";
import type { IncidentActionProps } from "./IncidentComment";
import { useIncidentReassign } from "./use-incident-reassign";
import { IncidentOwnerSearch } from "./IncidentOwnerSearch";
import { IncidentOwnerSelect } from "./IncidentOwnerSelect";
import { IncidentOwnerPaging } from "./IncidentOwnerPaging";

export function IncidentReassign(props: IncidentActionProps & { scope: IncidentScope }) {
  const { t } = useTranslation();
  const controller = useIncidentReassign(props);
  return (
    <fieldset disabled={props.isBusy}>
      <IncidentOwnerSearch controller={controller} />
      {controller.query.isError && <ErrorState onRetry={controller.retry} />}
      <IncidentOwnerSelect controller={controller} />
      <IncidentOwnerPaging controller={controller} />
      <Button aria-disabled={controller.isBlocked} onClick={controller.reassign}>
        {t("incidents.workspace.reassign")}
      </Button>
    </fieldset>
  );
}
