import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { InlineNotice } from "../../ui/InlineNotice";
import { TrainingReviewNotice } from "./TrainingReviewNotice";
import { TrainingCommandError } from "./TrainingCommandError";
interface Props {
  error?: unknown;
  receipt?: Schemas["PeopleReceipt"] | undefined;
  requiresReview: boolean;
  review: () => void;
}
export function TrainingFeedback({ error, receipt, requiresReview, review }: Props) {
  const { t } = useTranslation();
  return (
    <div aria-live="polite">
      {requiresReview && <TrainingReviewNotice onReview={review} />}
      {error !== undefined && <TrainingCommandError error={error} />}
      {receipt && <InlineNotice tone="success">{t("trainings.form.saved")}</InlineNotice>}
    </div>
  );
}
