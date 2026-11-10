import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { ReviewAccept } from "./ReviewAccept";
import { ReviewVoid } from "./ReviewVoid";
import { ReviewOpenIncident } from "./ReviewOpenIncident";
import type { ReviewAction } from "./review-query";

export interface ReviewActionsProps {
  canAccept: boolean;
  canOpenIncident: boolean;
  isBlocked: boolean;
  record: string;
  frame: string;
  send: (action: ReviewAction, reason?: string) => Promise<boolean>;
}

export function ReviewActions(props: ReviewActionsProps) {
  const { t } = useTranslation();
  const [isVoiding, setVoiding] = useState(false);
  return (
    <>
      <ReviewAccept {...props} />
      <Button
        variant="secondary"
        disabled={props.isBlocked}
        onClick={() => {
          setVoiding(true);
        }}
      >
        {t("reviews.workspace.void")}
      </Button>
      <ReviewOpenIncident {...props} />
      {isVoiding && (
        <ReviewVoid
          {...props}
          onClose={() => {
            setVoiding(false);
          }}
        />
      )}
    </>
  );
}
