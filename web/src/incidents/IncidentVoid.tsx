import { useTranslation } from "react-i18next";
import type { IncidentActionProps } from "./IncidentComment";
import { IncidentDraftField } from "./IncidentDraftField";
import { IncidentActionConfirmation } from "./IncidentActionConfirmation";
import { useIncidentVoid } from "./use-incident-void";
export function IncidentVoid(props: IncidentActionProps) {
  const { t } = useTranslation();
  const form = useIncidentVoid(props);
  return (
    <section>
      <IncidentDraftField {...form.field} />
      <IncidentActionConfirmation action="void" {...form.confirmation} />
      {form.isDependent && <p>{t("incidents.workspace.voidBlocked")}</p>}
    </section>
  );
}
