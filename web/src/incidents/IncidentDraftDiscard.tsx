import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
export function IncidentDraftDiscard({ onDiscard }: { onDiscard: () => void }) {
  const { t } = useTranslation();
  return (
    <Button variant="ghost" onClick={onDiscard}>
      {t("incidents.workspace.discardDraft")}
    </Button>
  );
}
