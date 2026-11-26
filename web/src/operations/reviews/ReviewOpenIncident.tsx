import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import type { ReviewActionsProps } from "./ReviewActions";

export function ReviewOpenIncident(props: ReviewActionsProps) {
  const { t } = useTranslation();
  if (!props.canOpenIncident) return null;
  return (
    <Button
      variant="tertiary"
      size="lg"
      leadingIcon={<TriangleAlert aria-hidden="true" />}
      disabled={props.isBlocked}
      onClick={() => {
        void props.send("open_incident");
      }}
    >
      {t("reviews.workspace.openIncident")}
    </Button>
  );
}
