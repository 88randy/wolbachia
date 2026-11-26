import { Check } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import type { ReviewActionsProps } from "./ReviewActions";

export function ReviewAccept(props: ReviewActionsProps) {
  const { t } = useTranslation();
  const reviewed = useRef("");
  return (
    <ConfirmDialog
      title={t("reviews.workspace.accept")}
      consequence={t("reviews.workspace.consequence")}
      actionLabel={t("reviews.workspace.accept")}
      trigger={
        <Button
          size="lg"
          leadingIcon={<Check aria-hidden="true" />}
          disabled={props.isBlocked || !props.canAccept}
          onClick={() => {
            reviewed.current = props.frame;
          }}
        >
          {t("reviews.workspace.accept")}
        </Button>
      }
      onConfirm={() => {
        if (reviewed.current === props.frame && !props.isBlocked) void props.send("accept");
      }}
    />
  );
}
