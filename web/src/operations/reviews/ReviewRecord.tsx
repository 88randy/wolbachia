import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { ReviewReadContent } from "./ReviewReadContent";
import { ReviewReasonForm } from "./ReviewReasonForm";
import { ReviewCommandNotice } from "./ReviewCommandNotice";
import { useReviewRecord } from "./use-review-record";
import type { ReviewScope } from "./review-query";

/** The private draft survives replaceable reads, errors and same-identity reauthentication. */
export function ReviewRecord(props: { scope: ReviewScope; id: string }) {
  const { t } = useTranslation();
  const state = useReviewRecord(props);
  return (
    <Card title={t("reviews.workspace.detail")}>
      <ReviewReadContent state={state} />
      {state.canDecide && <ReviewReasonForm state={state} />}
      {!state.isDenied && (
        <ReviewCommandNotice command={state.command} isReceiptObserved={state.isReceiptObserved} />
      )}
      <Button
        variant="secondary"
        disabled={state.command.isBusy || state.query.isFetching}
        onClick={() => {
          void state.refresh();
        }}
      >
        {t("reviews.workspace.refresh")}
      </Button>
    </Card>
  );
}
