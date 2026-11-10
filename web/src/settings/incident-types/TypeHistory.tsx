import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { TypeHistoryContent } from "./TypeHistoryContent";
import type { IncidentType, TypeScope } from "./incident-types-query";
export function TypeHistory({ scope, item }: { scope: TypeScope; item: IncidentType }) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  return (
    <Dialog
      trigger={<Button variant="secondary">{t("incidentTypes.history.title")}</Button>}
      title={t("incidentTypes.history.title")}
      description={t("incidentTypes.form.retainedRules")}
      open={isOpen}
      onOpenChange={setOpen}
    >
      {isOpen && <TypeHistoryContent scope={scope} item={item} />}
    </Dialog>
  );
}
