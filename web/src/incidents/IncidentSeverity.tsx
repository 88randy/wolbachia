import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import { Button } from "../ui/Button";
import type { IncidentActionProps } from "./IncidentComment";
import { useIncidentSeverity } from "./use-incident-severity";
export function IncidentSeverity(props: IncidentActionProps) {
  const { t } = useTranslation();
  const form = useIncidentSeverity(props);
  return (
    <fieldset disabled={props.isBusy}>
      <Select {...form.field} />
      <Button variant="secondary" aria-disabled={form.isBlocked} onClick={form.submit}>
        {t("incidents.workspace.changeSeverity")}
      </Button>
      {form.isProtected && <p>{t("incidents.workspace.protected")}</p>}
    </fieldset>
  );
}
