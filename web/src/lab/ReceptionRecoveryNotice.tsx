import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { InlineNotice } from "../ui/InlineNotice";
import type { ReceptionActions } from "./use-reception-command";

interface ReceptionRecoveryNoticeProps {
  actions: ReceptionActions;
  onReview: () => void;
}
export function ReceptionRecoveryNotice({ actions, onReview }: ReceptionRecoveryNoticeProps) {
  const { t } = useTranslation();
  return (
    <InlineNotice
      tone="warning"
      action={
        <Button variant="secondary" loading={actions.isBusy} onClick={onReview}>
          {t("labReception.scan.review")}
        </Button>
      }
    >
      {t("labReception.scan.reviewHint")}
    </InlineNotice>
  );
}
